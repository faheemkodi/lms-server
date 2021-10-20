import express from 'express';
import formidable from 'express-formidable';

const router = express.Router();

// Middleware imports
import { isInstructor, requireSignin, isEnrolled } from '../middleware';

// Controller imports
import {
  uploadImage,
  removeImage,
  create,
  read,
  uploadVideo,
  removeVideo,
  addLesson,
  update,
  removeLesson,
  updateLesson,
  publishCourse,
  unpublishCourse,
  courses,
  checkEnrolment,
  freeEnrolment,
  paidEnrolment,
  stripeSuccess,
  userCourses,
  markCompleted,
  listCompleted,
  markIncomplete,
} from '../controllers/course';

router.get('/courses', courses);

// Image
router.post('/course/upload-image', uploadImage);
router.post('/course/remove-image', removeImage);

// Course
router.post('/course', requireSignin, isInstructor, create);
router.put('/course/:slug', requireSignin, update);
router.get('/course/:slug', read);

// Video Upload
router.post(
  '/course/video-upload/:instructorId',
  requireSignin,
  formidable(),
  uploadVideo
);
router.post('/course/video-remove/:instructorId', requireSignin, removeVideo);

// Publish Unpublish
router.put('/course/publish/:courseId', requireSignin, publishCourse);
router.put('/course/unpublish/:courseId', requireSignin, unpublishCourse);

// Lesson
router.post('/course/lesson/:slug/:instructorId', requireSignin, addLesson);
router.put('/course/lesson/:slug/:instructorId', requireSignin, updateLesson);
router.put('/course/:slug/:lessonId', requireSignin, removeLesson);

router.get('/check-enrolment/:courseId', requireSignin, checkEnrolment);

// Enrolment
router.post('/free-enrolment/:courseId', requireSignin, freeEnrolment);
router.post('/paid-enrolment/:courseId', requireSignin, paidEnrolment);
router.get('/stripe-success/:courseId', requireSignin, stripeSuccess);

router.get('/user-courses', requireSignin, userCourses);
router.get('/user/course/:slug', requireSignin, isEnrolled, read);

// Mark completed
router.post('/mark-completed', requireSignin, markCompleted);
router.post('/list-completed', requireSignin, listCompleted);
router.post('/mark-incomplete', requireSignin, markIncomplete);

module.exports = router;
