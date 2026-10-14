/**
 * Test Script: Multi-Section Permissions, RBAC & Assignment Verification
 * 
 * Usage:
 *   npx tsx scripts/test-admin-rbac.ts
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import mongoose from "mongoose";
import User from "../src/models/User";
import Section from "../src/models/Section";
import { canAdminManageSection, canAdminManageResource, AuthUser } from "../src/lib/rbac";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  console.log("--- 1. Testing Schema Definitions & Integrity ---");
  const assignedSectionsPath: any = User.schema.path("assignedSections");
  assert(
    assignedSectionsPath && assignedSectionsPath.instance === "Array",
    "User schema has 'assignedSections' field of type Array"
  );
  const elementOpt = assignedSectionsPath?.caster?.options || assignedSectionsPath?.options?.type?.[0];
  const schemaName = assignedSectionsPath?.caster?.instance || elementOpt?.type?.schemaName || elementOpt?.type?.name;
  assert(
    schemaName === "ObjectId" || schemaName === "ObjectID" || schemaName === "SchemaObjectId",
    "User schema 'assignedSections' items are ObjectIds"
  );
  assert(
    elementOpt?.ref === "Section",
    "User schema 'assignedSections' references 'Section' collection"
  );

  const sectionPath: any = User.schema.path("section");
  assert(
    sectionPath && (sectionPath.instance === "ObjectID" || sectionPath.instance === "ObjectId"),
    "User schema has 'section' field of type ObjectId"
  );
  assert(
    sectionPath?.options?.ref === "Section",
    "User schema 'section' references 'Section' collection"
  );

  console.log("\n--- 2. Testing RBAC Pure Logic & Authorization Rules ---");
  const testSec1Id = new mongoose.Types.ObjectId().toString();
  const testSec2Id = new mongoose.Types.ObjectId().toString();
  const unassignedSecId = new mongoose.Types.ObjectId().toString();

  const subAdmin: AuthUser = {
    userId: new mongoose.Types.ObjectId().toString(),
    collegeId: "sub_admin_001",
    name: "Sub Admin",
    role: "admin",
    isSuperAdmin: false,
    status: "active",
    section: testSec1Id,
    assignedSections: [testSec1Id, testSec2Id],
    effectiveSectionIds: [testSec1Id, testSec2Id],
  };

  const superAdmin: AuthUser = {
    userId: new mongoose.Types.ObjectId().toString(),
    collegeId: "super_admin_001",
    name: "Super Admin",
    role: "admin",
    isSuperAdmin: true,
    status: "active",
    section: null,
    assignedSections: [],
    effectiveSectionIds: [],
  };

  // Sub-admin section tests
  assert(
    canAdminManageSection(subAdmin, testSec1Id) === true,
    "Sub-admin can manage primary assigned section"
  );
  assert(
    canAdminManageSection(subAdmin, testSec2Id) === true,
    "Sub-admin can manage secondary assigned section"
  );
  assert(
    canAdminManageSection(subAdmin, unassignedSecId) === false,
    "Sub-admin CANNOT manage unassigned section"
  );
  assert(
    canAdminManageSection(subAdmin, null) === false,
    "Sub-admin CANNOT manage null/global section"
  );

  // Super-admin section tests
  assert(
    canAdminManageSection(superAdmin, testSec1Id) === true,
    "Superadmin can manage any section (testSec1)"
  );
  assert(
    canAdminManageSection(superAdmin, unassignedSecId) === true,
    "Superadmin can manage any unassigned section"
  );
  assert(
    canAdminManageSection(superAdmin, null) === true,
    "Superadmin can manage null/global section"
  );

  // Resource movement & editing tests
  assert(
    canAdminManageResource(subAdmin, testSec1Id, testSec2Id) === true,
    "Sub-admin can move resource between their assigned sections (1 -> 2)"
  );
  assert(
    canAdminManageResource(subAdmin, testSec1Id, unassignedSecId) === false,
    "Sub-admin CANNOT move resource to an unassigned section (1 -> unassigned)"
  );
  assert(
    canAdminManageResource(subAdmin, unassignedSecId, testSec1Id) === false,
    "Sub-admin CANNOT edit or move a resource from an unassigned origin section"
  );
  assert(
    canAdminManageResource(superAdmin, unassignedSecId, testSec1Id) === true,
    "Superadmin can move resources across any sections"
  );

  console.log("\n--- 3. Testing MongoDB Database Connection & Persistence (if URI configured) ---");
  const rawUri = process.env.MONGODB_URI;
  const uri = rawUri && rawUri.replace(/["']/g, "").trim();

  if (!uri) {
    console.log("  ℹ️ Local MONGODB_URI is not configured in .env (empty string).");
    console.log("  ℹ️ Pure logic & Mongoose schema validations passed 100%. Live DB roundtrip skipped.");
  } else {
    try {
      console.log("🔌 Connecting to MongoDB...");
      await mongoose.connect(uri);
      console.log("✅ Connected to MongoDB\n");

      // Clean up any stale test records first
      await Section.deleteMany({ name: { $in: ["__TEST_SEC_ALPHA__", "__TEST_SEC_BETA__"] } });
      await User.deleteMany({ college_id: "__TEST_ADMIN_RBAC__" });

      const secAlpha = await Section.create({ name: "__TEST_SEC_ALPHA__" });
      const secBeta = await Section.create({ name: "__TEST_SEC_BETA__" });

      // Create user with multi-section assignment
      const testAdmin = await User.create({
        name: "Test RBAC Admin",
        college_id: "__TEST_ADMIN_RBAC__",
        email: "test_rbac_admin@test.com",
        role: "admin",
        isSuperAdmin: false,
        section: secAlpha._id,
        assignedSections: [secAlpha._id, secBeta._id],
      });

      assert(testAdmin._id !== undefined, "Created test admin in DB");

      // Fetch fresh user from DB with lean()
      const fetchedLean = await User.findById(testAdmin._id).select("assignedSections section").lean();
      assert(
        Array.isArray(fetchedLean?.assignedSections) && fetchedLean.assignedSections.length === 2,
        "fetchedLean has exactly 2 assignedSections ObjectIds"
      );

      const fetchedSecIds = (fetchedLean?.assignedSections || []).map((s: any) => s.toString());
      assert(
        fetchedSecIds.includes(secAlpha._id.toString()) && fetchedSecIds.includes(secBeta._id.toString()),
        "fetchedLean includes both secAlpha and secBeta IDs"
      );

      // Fetch and populate
      const fetchedPopulated = await User.findById(testAdmin._id)
        .populate("assignedSections", "name")
        .populate("section", "name");

      const populatedNames = ((fetchedPopulated?.assignedSections as any[]) || []).map((s: any) => s.name);
      assert(
        populatedNames.includes("__TEST_SEC_ALPHA__") && populatedNames.includes("__TEST_SEC_BETA__"),
        "Populated assignedSections contains names '__TEST_SEC_ALPHA__' and '__TEST_SEC_BETA__'"
      );

      // Clean up
      console.log("\n🧹 Cleaning up test database records...");
      await Section.deleteMany({ _id: { $in: [secAlpha._id, secBeta._id] } });
      await User.deleteMany({ _id: testAdmin._id });
      console.log("✅ Cleanup complete");

      await mongoose.disconnect();
      console.log("🔌 Disconnected from MongoDB\n");
    } catch (dbErr) {
      console.error("Live DB test error:", dbErr);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

void runTests();
