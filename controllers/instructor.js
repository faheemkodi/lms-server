import User from '../models/user';
import Course from '../models/course';
import queryString from 'query-string';
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// Make instructor controller
export const makeInstructor = async (req, res) => {
  try {
    //1. Find user from database
    const user = await User.findById(req.user._id).exec();
    //2. If user doesn't have stripe_account_id, create that
    if (!user.stripe_account_id) {
      const account = await stripe.accounts.create({ type: 'standard' });
      // console.log('ACCOUNT =>', account.id);
      user.stripe_account_id = account.id;
      user.save();
    }
    //3. Create account link based on account id(for frontend onboarding completion)
    let accountLink = await stripe.accountLinks.create({
      account: user.stripe_account_id,
      refresh_url: process.env.STRIPE_REDIRECT_URL,
      return_url: process.env.STRIPE_REDIRECT_URL,
      type: 'account_onboarding',
    });
    //   console.log(accountLink);
    //4. Pre-fill any info search as email(optional), then send URL response to frontend
    accountLink = Object.assign(accountLink, {
      'stripe_user[email]': user.email,
    });
    //5. Then send account link as response to frontend
    res.send(`${accountLink.url}?${queryString.stringify(accountLink)}`);
  } catch (err) {
    console.log('MAKE INSTRUCTOR ERROR', err);
  }
};

// Get account status controller
export const getAccountStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).exec();
    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    // console.log('ACCOUNT', account);
    if (!account.charges_enabled) {
      return res.status(401).send('Unauthorized');
    } else {
      const statusUpdated = await User.findByIdAndUpdate(
        user._id,
        {
          stripe_seller: account,
          $addToSet: { role: 'Instructor' },
        },
        { new: true }
      )
        .select('-password')
        .exec();
      res.json(statusUpdated);
    }
  } catch (err) {
    console.log(err);
  }
};

// Current instructor controller
export const currentInstructor = async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select('-password').exec();
    if (!user.role.includes('Instructor')) {
      return res.sendStatus(403);
    } else {
      res.json({ ok: true });
    }
  } catch (err) {
    console.log(err);
  }
};

// Instructor courses controller
export const instructorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user._id })
      .sort({ createdAt: -1 })
      .exec();
    res.json(courses);
  } catch (err) {
    console.log(err);
  }
};

// Student count controller
export const studentCount = async (req, res) => {
  try {
    const users = await User.find({ courses: req.body.courseId })
      .select('id')
      .exec();
    res.json(users);
  } catch (err) {
    console.log(err);
  }
};

// Instructor balance controller
export const instructorBalance = async (req, res) => {
  try {
    let user = await User.findById(req.user._id).exec();
    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripe_account_id,
    });
    res.json(balance);
  } catch (err) {
    console.log(err);
  }
};

// Instructor Payout Settings controller
export const instructorPayoutSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).exec();
    const loginLink = await stripe.accounts.createLoginLink(
      user.stripe_seller.id,
      { redirect_url: process.env.STRIPE_SETTINGS_REDIRECT }
    );
    res.json(loginLink.url);
  } catch (err) {
    console.log('Stripe Payout Settings Error =>', err);
  }
};
