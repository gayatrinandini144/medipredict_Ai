const mongoose = require('mongoose');

// Anonymous record of a finished consultation. No names, emails or IDs are stored.
const schema = new mongoose.Schema(
  {
    symptoms: [String],
    top: String,
    probability: Number,
    questions: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Consultation', schema);
