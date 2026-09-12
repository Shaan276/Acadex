/**
 * @module API/PDFProxy
 * @description Proxy endpoint that streams binary PDF bytes from Google Drive or external URLs
 * to the browser memory (Blob URL). Solves browser CORS restrictions and keeps the student
 * 100% on au-acadex.com (/user/dashboard/viewer?url=...).
 *
 * Security fixes applied:
 * - C-04: Added authentication check (JWT via middleware headers)
 * - C-04: URL whitelist — only drive.google.com allowed
 * - C-06: OAuth2 token support added alongside Service Account
 * - H-07: Response is streamed directly instead of loaded into memory
 */
import { NextResponse } from "next/server";
import { google } from "googleapis";

/** Allowed hostnames that can be proxied. Prevents SSRF. */
const ALLOWED_HOSTNAMES = new Set([
  "drive.google.com",
  "lh3.googleusercontent.com",
  "docs.google.com",
]);

/** Build an authenticated Google Drive client using OAuth2 or Service Account. */
function getDriveClient() {
  // Prefer OAuth2 refresh token (standard for this project)
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return google.drive({ version: "v3", auth: oauth2Client });
    } catch {
      // fall through to service account
    }
  }

  // Fallback: Service Account
  const jsonCredentialsStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonCredentialsStr) return null;
  try {
    const credentials = JSON.parse(jsonCredentialsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return google.drive({ version: "v3", auth });
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // C-04: Authentication check — middleware injects x-user-id if valid JWT
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Missing required 'url' parameter." },
        { status: 400 }
      );
    }

    // C-04: Whitelist check — only allow known Google domains
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    if (!ALLOWED_HOSTNAMES.has(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: "URL not allowed. Only Google Drive URLs are supported." },
        { status: 403 }
      );
    }

    const filenameParam = searchParams.get("filename") || "document";
    const encodedFilename = encodeURIComponent(filenameParam);

    // 1. Try to extract Google Drive File ID
    const driveMatch = fileUrl.match(
      /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/
    );
    const fileId = driveMatch ? driveMatch[1] : null;

    if (fileId) {
      const drive = getDriveClient();
      if (drive) {
        try {
          // C-06: Use authenticated Drive API (works with both OAuth2 and SA)
          // H-07: Use stream response type to avoid loading entire file into RAM
          const driveRes = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "stream" }
          );

          const driveContentType =
            (driveRes.headers && driveRes.headers["content-type"]) ||
            "application/pdf";

          // H-07: Pipe the stream directly without buffering the whole file
          return new Response(driveRes.data as unknown as ReadableStream, {
            status: 200,
            headers: {
              "Content-Type": driveContentType as string,
              "Content-Disposition": `inline; filename="${encodedFilename}"`,
              "Cache-Control": "private, max-age=3600",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (driveErr) {
          console.warn(
            "Drive API media fetch failed, falling back to direct fetch:",
            driveErr
          );
        }
      }
    }

    // 2. Authenticated direct fetch fallback (only for whitelisted domains)
    const directFetchUrl = fileId
      ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
      : fileUrl;

    const response = await fetch(directFetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file stream: HTTP ${response.status}`);
    }

    const contentType =
      response.headers.get("content-type") || "application/pdf";

    // H-07: Stream the response body directly instead of buffering
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodedFilename}"`,
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("PDF Proxy Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy document stream.",
      },
      { status: 500 }
    );
  }
}
