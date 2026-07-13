require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Settings = require("../models/Settings");

async function seed() {
  await connectDB();

  const existingAdmin = await User.findOne({ email: "admin@saraspos.com" });
  if (!existingAdmin) {
    await User.create({
      name: "Admin",
      email: "admin@saraspos.com",
      password: "Admin@123",
      role: "admin",
    });
    console.log(
      "Default admin created -> email: admin@saraspos.com | password: Admin@123",
    );
  } else {
    console.log("Admin user already exists, skipping.");
  }

  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({});
    console.log("Default settings created.");
  } else {
    console.log("Settings already exist, skipping.");
  }

  await mongoose.connection.close();
  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
