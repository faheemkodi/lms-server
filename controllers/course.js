import AWS from 'aws-sdk';
import { nanoid } from 'nanoid';
import Course from '../models/course';
import Completed from '../models/completed';
import slugify from 'slugify';
import { readFileSync } from 'fs';
import User from '../models/user';
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// AWS Configuration
const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

const S3 = new AWS.S3(awsConfig);

// Upload image controller
export const uploadImage = async (req, res) => {
  //   console.log(req.body);
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).send('No image selected');
    }

    // Prepare image for S3 Upload
    const base64Data = new Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    const type = image.split(';')[0].split('/')[1];

    // Image params
    const params = {
      Bucket: 'kengram-bucket',
      Key: `${nanoid()}.${type}`,
      Body: base64Data,
      ACL: 'public-read',
      ContentEncoding: 'base64',
      ContentType: `image/${type}`,
    };

    // Upload to S3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log(err);
        return res.sendStatus(400);
      }
      console.log(data);
      res.send(data);
    });
  } catch (err) {
    console.log(err);
  }
};

// Remove image controller
export const removeImage = async (req, res) => {
  try {
    const { image } = req.body;
    // Image params
    const params = {
      Bucket: image.Bucket,
      Key: image.Key,
    };
    // Send remove request to S3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      res.send({ ok: true });
    });
  } catch (err) {
    console.log(err);
  }
};

// Create course controller
export const create = async (req, res) => {
  // console.log('Create course', req.body);
  try {
    const alreadyExists = await Course.findOne({
      slug: slugify(req.body.name.toLowerCase()),
    });
    if (alreadyExists) {
      return res
        .status(400)
        .send('Course name already exists. Please try another one.');
    }
    const course = await new Course({
      slug: slugify(req.body.name),
      instructor: req.user._id,
      ...req.body,
    }).save();

    res.json(course);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Course creation failed. Please try again.');
  }
};

// Course read controller
export const read = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate('instructor', '_id name')
      .exec();
    res.json(course);
  } catch (err) {
    console.log(err);
  }
};

// Video upload controller
export const uploadVideo = async (req, res) => {
  try {
    // Compare logged in user
    // console.log('Logged in User ID', req.user._id);
    // console.log('Course Creator ID', req.params.instructorId);
    if (req.user._id !== req.params.instructorId) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const { video } = req.files;
    // console.log(video);
    if (!video) {
      return res.status(400).send('No video.');
    }

    // Video params
    const params = {
      Bucket: 'kengram-bucket',
      Key: `${nanoid()}.${video.type.split('/')[1]}`,
      Body: readFileSync(video.path),
      ACL: 'public-read',
      ContentType: video.type,
    };

    // Upload video to S3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      console.log(data);
      res.send(data);
    });
  } catch (err) {
    console.log(err);
  }
};

// Video removal controller
export const removeVideo = async (req, res) => {
  try {
    // Compare logged in user
    // console.log('Logged in User ID', req.user._id);
    // console.log('Course Creator ID', req.params.instructorId);
    if (req.user._id !== req.params.instructorId) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const { Bucket, Key } = req.body;
    // console.log(video);
    // Video params
    const params = {
      Bucket,
      Key,
    };

    // Delete video from S3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      console.log(data);
      res.send(data);
    });
  } catch (err) {
    console.log(err);
  }
};

// Add lesson controller
export const addLesson = async (req, res) => {
  try {
    const { slug, instructorId } = req.params;
    const { title, content, video } = req.body;

    // Compare logged in user
    // console.log('Logged in User ID', req.user._id);
    // console.log('Course Creator ID', req.params.instructorId);
    if (req.user._id !== instructorId) {
      return res.status(400).send('Unauthorized. Access denied.');
    }
    const updated = await Course.findOneAndUpdate(
      { slug },
      {
        $push: { lessons: { title, content, video, slug: slugify(title) } },
      },
      { new: true }
    )
      .populate('instructor', '_id name')
      .exec();
    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Add lesson failed.');
  }
};

// Update course controller
export const update = async (req, res) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ slug }).exec();

    if (req.user._id != course.instructor) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const updated = await Course.findOneAndUpdate({ slug }, req.body, {
      new: true,
    }).exec();

    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send(err.message);
  }
};

// Remove lesson controller
export const removeLesson = async (req, res) => {
  const { slug, lessonId } = req.params;
  const course = await Course.findOne({ slug }).exec();

  if (req.user._id != course.instructor) {
    return res.status(400).send('Unauthorized. Access denied.');
  }

  const deleted = await Course.findByIdAndUpdate(course._id, {
    $pull: { lessons: { _id: lessonId } },
  }).exec();
  res.json({ ok: true });
};

// Update lesson controller
export const updateLesson = async (req, res) => {
  try {
    const { slug } = req.params;
    const { _id, title, content, video, free_preview } = req.body;
    const course = await Course.findOne({ slug }).select('instructor').exec();

    if (course.instructor._id != req.user._id) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const updated = await Course.updateOne(
      { 'lessons._id': _id },
      {
        $set: {
          'lessons.$.title': title,
          'lessons.$.content': content,
          'lessons.$.video': video,
          'lessons.$.free_preview': free_preview,
        },
      },
      { new: true }
    ).exec();

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send('Lesson update failed.');
  }
};

// Publish controller
export const publishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('instructor').exec();

    if (course.instructor._id != req.user._id) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const updated = await Course.findByIdAndUpdate(
      courseId,
      { published: true },
      { new: true }
    ).exec();
    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Publish failed.');
  }
};

// Unpublish controller
export const unpublishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('instructor').exec();

    if (course.instructor._id != req.user._id) {
      return res.status(400).send('Unauthorized. Access denied.');
    }

    const updated = await Course.findByIdAndUpdate(
      courseId,
      { published: false },
      { new: true }
    ).exec();
    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Unpublish failed.');
  }
};

// Fetch published courses controller
export const courses = async (req, res) => {
  const all = await Course.find({ published: true })
    .populate('instructor', '_id name')
    .exec();
  res.json(all);
};

// Check enrolment controller
export const checkEnrolment = async (req, res) => {
  const { courseId } = req.params;
  // Find currently logged in user enrolled courses
  const user = await User.findById(req.user._id).exec();
  // Check if course id is found in user's courses array
  let ids = [];
  let length = user.courses && user.courses.length;
  for (let i = 0; i < length; i++) {
    ids.push(user.courses[i].toString());
  }
  res.json({
    status: ids.includes(courseId),
    course: await Course.findById(courseId).exec(),
  });
};

// Free enrolment controller
export const freeEnrolment = async (req, res) => {
  try {
    // Check if course is free, prevent hacks
    const course = await Course.findById(req.params.courseId).exec();
    if (course.paid) return;

    const result = await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { courses: course._id },
      },
      { new: true }
    ).exec();
    res.json({
      message: 'Congrats! You have successfully enrolled. Happy learning!',
      course,
    });
  } catch (err) {
    console.log('Free enrolment error', err);
    res.status(400).send('Enrolment failed.');
  }
};

// Paid enrolment controller
export const paidEnrolment = async (req, res) => {
  try {
    // Check if course is paid
    const course = await Course.findById(req.params.courseId)
      .populate('instructor')
      .exec();
    if (!course.paid) {
      return;
    }
    // Charge Kengram platform fee - 100%
    const fee = course.price;
    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      // Purchase details
      line_items: [
        {
          name: course.name,
          amount: Math.round(course.price.toFixed(2) * 100),
          currency: 'inr',
          quantity: 1,
        },
      ],
      // Charge buyer and transfer remaining balance to seller (after fee)
      payment_intent_data: {
        application_fee_amount: Math.round(fee.toFixed(2) * 100),
      },
      // Redirect URL after successful payment
      success_url: `${process.env.STRIPE_SUCCESS_URL}/${course._id}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    });
    console.log('Session ID ==>', session);

    await User.findByIdAndUpdate(req.user._id, {
      stripeSession: session,
    }).exec();
    res.send(session.id);
  } catch (err) {
    console.log('Paid enrolment error =>', err);
    return res.status(400).send('Enrolment failed. Please try again.');
  }
};

// Stripe success controller
export const stripeSuccess = async (req, res) => {
  try {
    // Find course
    const course = await Course.findById(req.params.courseId).exec();
    // Get user
    const user = await User.findById(req.user._id).exec();
    // If no stripe session, return immediately
    if (!user.stripeSession.id) {
      return res.sendStatus(400);
    }
    // Retrieve stripe session
    const session = await stripe.checkout.sessions.retrieve(
      user.stripeSession.id
    );
    console.log('Stripe Success =>', session);
    // If session payment status is paid, push course to user's course array
    if (session.payment_status === 'paid') {
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { courses: course._id },
        $set: { stripeSession: {} },
      }).exec();
    }
    res.json({ success: true, course });
  } catch (err) {
    console.log('Stripe Success Error =>', err);
    res.json({ success: false });
  }
};

// User enrolled course list controller
export const userCourses = async (req, res) => {
  const user = await User.findById(req.user._id).exec();
  const courses = await Course.find({ _id: { $in: user.courses } })
    .populate('instructor', '_id name')
    .exec();
  res.json(courses);
};

// Mark completed controller
export const markCompleted = async (req, res) => {
  const { courseId, lessonId } = req.body;
  // console.log(courseId, lessonId);
  // Check if 'Completed' is already created
  const existing = await Completed.findOne({
    user: req.user._id,
    course: courseId,
  }).exec();

  if (existing) {
    // Update 'Completed'
    const updated = await Completed.findOneAndUpdate(
      { user: req.user._id, course: courseId },
      {
        $addToSet: { lessons: lessonId },
      }
    ).exec();
    res.json({ ok: true });
  } else {
    // Create new 'Completed'
    const created = await new Completed({
      user: req.user._id,
      course: courseId,
      lessons: lessonId,
    }).save();
    res.json({ ok: true });
  }
};

// List Completed controller
export const listCompleted = async (req, res) => {
  try {
    const list = await Completed.findOne({
      user: req.user._id,
      course: req.body.courseId,
    }).exec();
    list && res.json(list.lessons);
  } catch (err) {
    console.log(err);
  }
};

// Mark Incomplete controller
export const markIncomplete = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;
    const updated = await Completed.findOneAndUpdate(
      {
        user: req.user._id,
        course: courseId,
      },
      {
        $pull: { lessons: lessonId },
      }
    ).exec();
    res.json({ ok: true });
  } catch (err) {
    console.log(err);
  }
};
