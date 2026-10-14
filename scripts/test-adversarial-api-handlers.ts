/**
 * @file scripts/test-adversarial-api-handlers.ts
 * @description Adversarial test suite exercising actual Next.js App Router API handlers.
 * Verifies that unauthorized cross-section access, role escalation attempts,
 * unauthorized resource moves, and SSRF attacks are strictly DENIED with 401/403.
 */
import mongoose from "mongoose";

// Set environment and connection cache BEFORE dynamic route imports
process.env.MONGODB_URI = "mongodb://localhost:27017/acadex_test";
process.env.JWT_SECRET = "acadex_super_secret_test_jwt_key_1234567890";
(global as any).mongooseCache = {
  conn: mongoose,
  promise: Promise.resolve(mongoose),
};

import User from "../src/models/User";
import Note from "../src/models/Note";
import Section from "../src/models/Section";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

function makeMockDoc(data: any) {
  if (!data) return null;
  return {
    ...data,
    select: () => ({
      lean: async () => data,
      populate: () => ({ lean: async () => data }),
    }),
    populate: async () => data,
    save: async () => {},
    then: (resolve: any) => resolve(data),
  };
}

async function runAdversarialTests() {
  console.log("=== ACADEX ADVERSARIAL API HANDLER AUDIT SUITE ===\n");

  // Dynamic import after mock setup
  const { PUT: updateNoteHandler, DELETE: deleteNoteHandler } = await import("../src/app/api/notes/[id]/route");
  const { PATCH: updateStudentHandler } = await import("../src/app/api/admin/students/[id]/route");
  const { POST: createSectionHandler } = await import("../src/app/api/sections/route");
  const { POST: resetPasswordHandler } = await import("../src/app/api/admin/reset-password/route");
  const { GET: pdfProxyHandler } = await import("../src/app/api/pdf-proxy/route");

  const SEC_A = "66f000000000000000000001";
  const SEC_B = "66f000000000000000000002";
  const SEC_UNASSIGNED = "66f000000000000000000099";

  const subAdminUser = {
    _id: "66f0000000000000000000aa",
    college_id: "ADMIN_A",
    name: "Sub Admin A",
    role: "admin",
    isSuperAdmin: false,
    status: "active",
    section: SEC_A,
    assignedSections: [SEC_A, SEC_B],
    effectiveSectionIds: [SEC_A, SEC_B],
  };

  const studentUser = {
    _id: "66f0000000000000000000bb",
    college_id: "STU_1",
    name: "Student 1",
    role: "student",
    isSuperAdmin: false,
    status: "active",
    section: SEC_A,
    assignedSections: [],
    effectiveSectionIds: [SEC_A],
  };

  const superAdminUser = {
    _id: "66f0000000000000000000cc",
    college_id: "SUPER_1",
    name: "Super Admin",
    role: "admin",
    isSuperAdmin: true,
    status: "active",
    section: null,
    assignedSections: [],
    effectiveSectionIds: [],
  };

  const originalUserFindById = User.findById;
  const originalNoteFindById = Note.findById;
  const originalSectionFindById = Section.findById;

  try {
    // ── 1. UNAUTHORIZED CROSS-SECTION ACCESS & RESOURCE MOVES ──
    console.log("--- 1. Testing Cross-Section Resource Protection (/api/notes/[id]) ---");

    (Note.findById as any) = (id: string) => makeMockDoc({
      _id: id,
      title: "Secret Exam Notes",
      file_url: "https://drive.google.com/file/d/test12345/view",
      section: SEC_UNASSIGNED,
    });

    (User.findById as any) = (_id: string) => makeMockDoc(subAdminUser);

    // Sub-admin trying to modify note in SEC_UNASSIGNED
    const putReq1 = new Request("http://localhost:3000/api/notes/note123", {
      method: "PUT",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Tampered Title" }),
    });

    const res1 = await updateNoteHandler(putReq1, { params: Promise.resolve({ id: "note123" }) });
    assert(res1.status === 403, "Sub-admin cannot update note in unassigned section (Expect 403)");

    // Sub-admin trying to delete note in SEC_UNASSIGNED
    const delReq1 = new Request("http://localhost:3000/api/notes/note123", {
      method: "DELETE",
      headers: { "x-user-id": subAdminUser._id },
    });
    const delRes1 = await deleteNoteHandler(delReq1, { params: Promise.resolve({ id: "note123" }) });
    assert(delRes1.status === 403, "Sub-admin cannot delete note in unassigned section (Expect 403)");

    // Sub-admin trying to move note from SEC_A to SEC_UNASSIGNED
    (Note.findById as any) = (id: string) => makeMockDoc({
      _id: id,
      title: "Notes A",
      file_url: "https://drive.google.com/file/d/test12345/view",
      section: SEC_A,
    });

    const moveReqInvalid = new Request("http://localhost:3000/api/notes/note123", {
      method: "PUT",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ section: SEC_UNASSIGNED }),
    });

    const moveResInvalid = await updateNoteHandler(moveReqInvalid, { params: Promise.resolve({ id: "note123" }) });
    assert(moveResInvalid.status === 403, "Sub-admin cannot move note to unassigned target section (Expect 403)");

    // ── 2. ROLE ESCALATION & ADMIN PRIVILEGE TAMPERING ──
    console.log("\n--- 2. Testing Role Escalation Defense (/api/admin/students/[id]) ---");

    const targetStudent = {
      _id: "66f0000000000000000000ee",
      name: "Target Student",
      role: "student",
      isSuperAdmin: false,
      section: SEC_A,
    };

    (User.findById as any) = (id: string) => {
      if (String(id) === subAdminUser._id) {
        return makeMockDoc(subAdminUser);
      }
      return makeMockDoc(targetStudent);
    };

    // Sub-admin attempting to elevate student to superadmin
    const escalateReq1 = new Request("http://localhost:3000/api/admin/students/student123", {
      method: "PATCH",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ isSuperAdmin: true }),
    });

    const escalateRes1 = await updateStudentHandler(escalateReq1, { params: Promise.resolve({ id: "student123" }) });
    assert(escalateRes1.status === 403, "Sub-admin cannot promote user to isSuperAdmin: true (Expect 403)");

    // Sub-admin attempting to change user role to admin
    const escalateReq2 = new Request("http://localhost:3000/api/admin/students/student123", {
      method: "PATCH",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "admin" }),
    });

    const escalateRes2 = await updateStudentHandler(escalateReq2, { params: Promise.resolve({ id: "student123" }) });
    assert(escalateRes2.status === 403, "Sub-admin cannot alter user roles (Expect 403)");

    // Sub-admin attempting to reset another admin's password
    const targetAdmin = {
      _id: "66f0000000000000000000ff",
      role: "admin",
      isSuperAdmin: false,
      section: SEC_B,
    };
    (User.findById as any) = (id: string) => {
      if (String(id) === subAdminUser._id) {
        return makeMockDoc(subAdminUser);
      }
      return makeMockDoc(targetAdmin);
    };

    const resetReq = new Request("http://localhost:3000/api/admin/reset-password", {
      method: "POST",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: targetAdmin._id }),
    });

    const resetRes = await resetPasswordHandler(resetReq);
    assert(resetRes.status === 403, "Sub-admin cannot reset password for other admins (Expect 403)");

    // ── 3. ACADEMIC STRUCTURE MUTATION RESTRICTION ──
    console.log("\n--- 3. Testing Academic Structure Lockdown (/api/sections) ---");

    (User.findById as any) = (id: string) => {
      if (String(id) === subAdminUser._id) {
        return makeMockDoc(subAdminUser);
      }
      if (String(id) === studentUser._id) {
        return makeMockDoc(studentUser);
      }
      return null;
    };

    // Sub-admin attempting to create a section
    const createSecReq = new Request("http://localhost:3000/api/sections", {
      method: "POST",
      headers: {
        "x-user-id": subAdminUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rogue Section", stream: "stream123", semester: 1 }),
    });

    const createSecRes = await createSectionHandler(createSecReq);
    assert(createSecRes.status === 403, "Sub-admin cannot create academic sections (Expect 403)");

    // Student attempting to create a section
    const studentSecReq = new Request("http://localhost:3000/api/sections", {
      method: "POST",
      headers: {
        "x-user-id": studentUser._id,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Student Section", stream: "stream123", semester: 1 }),
    });

    const studentSecRes = await createSectionHandler(studentSecReq);
    assert(studentSecRes.status === 403, "Student cannot create academic sections (Expect 403)");

    // Unauthenticated caller attempting to create a section
    const unauthSecReq = new Request("http://localhost:3000/api/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Anon Section" }),
    });

    const unauthSecRes = await createSectionHandler(unauthSecReq);
    assert(unauthSecRes.status === 401, "Unauthenticated user cannot create academic sections (Expect 401)");

    // ── 4. PDF PROXY SSRF, METADATA & RANGE SECURITY ──
    console.log("\n--- 4. Testing PDF Proxy SSRF & Security Defense (/api/pdf-proxy) ---");

    (User.findById as any) = (_id: string) => makeMockDoc(studentUser);

    // 4.1 Unauthenticated request
    const unauthProxyReq = new Request("http://localhost:3000/api/pdf-proxy?url=https://drive.google.com/file/d/123/view");
    const unauthProxyRes = await pdfProxyHandler(unauthProxyReq);
    assert(unauthProxyRes.status === 401, "Unauthenticated request to pdf-proxy is rejected with 401");

    // Helper for testing target URLs
    async function testProxyUrl(targetUrl: string, expectedStatus: number, desc: string) {
      const req = new Request(`http://localhost:3000/api/pdf-proxy?url=${encodeURIComponent(targetUrl)}`, {
        headers: { "x-user-id": studentUser._id },
      });
      const res = await pdfProxyHandler(req);
      assert(res.status === expectedStatus, `${desc} -> (Expect ${expectedStatus}, got ${res.status})`);
    }

    // SSRF vectors
    await testProxyUrl("http://drive.google.com/file/d/123/view", 403, "Rejects plain HTTP protocol");
    await testProxyUrl("https://127.0.0.1/file.pdf", 403, "Rejects IPv4 loopback (127.0.0.1)");
    await testProxyUrl("https://10.0.0.1/internal.pdf", 403, "Rejects private RFC1918 10.0.0.0/8");
    await testProxyUrl("https://192.168.1.1/router.pdf", 403, "Rejects private RFC1918 192.168.0.0/16");
    await testProxyUrl("https://172.16.0.1/vpc.pdf", 403, "Rejects private RFC1918 172.16.0.0/12");
    await testProxyUrl("https://169.254.169.254/latest/meta-data", 403, "Rejects Cloud Metadata 169.254.169.254");
    await testProxyUrl("https://[::1]/secret.pdf", 403, "Rejects IPv6 loopback ([::1])");
    await testProxyUrl("https://attacker.com/drive.google.com/file.pdf", 403, "Rejects non-allowlisted external domain");
    await testProxyUrl("https://user:pass@drive.google.com/file/d/123/view", 403, "Rejects URL containing credentials/userinfo");
    await testProxyUrl("https://drive.google.com:8443/file/d/123/view", 403, "Rejects URL with non-standard port");

  } finally {
    User.findById = originalUserFindById;
    Note.findById = originalNoteFindById;
    Section.findById = originalSectionFindById;
  }

  console.log("\n========================================");
  console.log(`Adversarial Tests Finished: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("========================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialTests().catch((err) => {
  console.error("Adversarial test error:", err);
  process.exit(1);
});
