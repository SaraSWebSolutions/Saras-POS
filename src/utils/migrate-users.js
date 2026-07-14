/**
 * One-time migration: patches any existing User documents created before
 * username/businessName/country/agreedToTerms became required fields.
 *
 * Safe to run multiple times - it only fills in values that are missing.
 *
 * Usage:
 *   node src/utils/migrate-users.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function migrate() {
  await connectDB();

  const users = await User.find({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { businessName: { $exists: false } },
      { country: { $exists: false } },
      { agreedToTerms: { $exists: false } },
    ],
  });

  console.log(`Found ${users.length} user(s) needing migration.`);

  for (const user of users) {
    let changed = false;

    if (!user.username) {
      // Derive a username from the email (or fall back to the user's _id)
      user.username = (
        user.email
          ? user.email.split("@")[0]
          : `user${user._id.toString().slice(-6)}`
      ).toLowerCase();
      changed = true;
    }
    if (!user.businessName) {
      user.businessName = "My Business";
      changed = true;
    }
    if (!user.country) {
      user.country = "India";
      changed = true;
    }
    if (user.agreedToTerms === undefined || user.agreedToTerms === null) {
      user.agreedToTerms = true;
      changed = true;
    }

    if (changed) {
      await user.save({ validateBeforeSave: false });
      console.log(
        `Patched user: ${user.email || user._id} -> username: ${user.username}`,
      );
    }
  }

  console.log("Migration complete.");
  await mongoose.connection.close();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
