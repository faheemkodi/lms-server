import mongoose from 'mongoose';
const { Schema } = mongoose;
const { ObjectId } = Schema;

const completedSchema = new Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
    },
    course: {
      type: ObjectId,
      ref: 'Course',
    },
    lessons: [],
  },
  { timestamps: true }
);

export default mongoose.model('Completed', completedSchema);
