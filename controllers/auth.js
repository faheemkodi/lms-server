import User from '../models/user';
import { hashPassword, comparePassword } from '../utils/auth';
import jwt from 'jsonwebtoken';
import AWS from 'aws-sdk';
import { nanoid } from 'nanoid';

// AWS Configuration
const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

// AWS Simple Email Service
const SES = new AWS.SES(awsConfig);

// Register controller
export const register = async (req, res) => {
  try {
    // console.log(req.body);
    const { name, email, password } = req.body;
    // Validation checks
    if (!name) {
      return res.status(400).send('Name is required.');
    }
    if (!password || password.length < 8) {
      return res
        .status(400)
        .send('Password is required and should be a minimum of 8 characters.');
    }
    let userExist = await User.findOne({ email }).exec();
    if (userExist) {
      return res
        .status(400)
        .send('A user already exists with the specified email.');
    }
    // Password hashing
    const hashedPassword = await hashPassword(password);
    // Register
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });
    await user.save();
    console.log('Saved user', user);
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send('Error occurred. Please try again.');
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    // console.log(req.body);
    const { email, password } = req.body;
    // Check if user with email exists in database
    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res
        .status(400)
        .send('User not found. Please enter correct email.');
    }
    // If user exists, check password
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(400).send('Wrong password.');
    }
    // If password matches, create signed JWT
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    // Return user and token to client, excluding hashed password
    user.password = undefined;
    // Send token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      // secure: true, // Mandates https to work (in production)
    });
    // Send user as JSON response
    res.json(user);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Error logging in. Please try again.');
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    res.clearCookie('token');
    return res.json({ message: 'Successfully logged out.' });
  } catch (err) {
    console.log(err);
  }
};

// Current user controller
export const currentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').exec();
    console.log('CURRENT USER', user);
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
  }
};

// Send email controller
export const sendTestEmail = async (req, res) => {
  // console.log('Send email using SES');
  // res.json({ ok: true });
  const params = {
    Source: process.env.EMAIL_FROM,
    Destination: {
      ToAddresses: ['kengram.dev@gmail.com'],
    },
    ReplyToAddresses: [process.env.EMAIL_FROM],
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
          <html>
            <h1>Reset Password Link</h1>
             <p>Please use the following link to reset your password</p>
          </html>
          `,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Password Reset Link',
      },
    },
  };

  const emailSent = SES.sendEmail(params).promise();

  emailSent
    .then((data) => {
      console.log(data);
      res.json({ ok: true });
    })
    .catch((err) => {
      console.log(err);
    });
};

// Forgot password controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    // console.log(email);
    const shortCode = nanoid(6).toUpperCase();
    const user = await User.findOneAndUpdate(
      { email },
      { passwordResetCode: shortCode }
    );
    if (!user) {
      return res.status(400).send('User not found');
    }
    // Prepare for sending email
    const params = {
      Source: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: `
              <html>
                <h1>Reset password</h1>
                <p>Use this code to reset your password</p>
                <h2 style='color:gold;'>${shortCode}</h2>
                <i>kengram.com</i>
              </html>
            `,
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Password reset code',
        },
      },
    };
    // Send email
    const emailSent = SES.sendEmail(params).promise();
    emailSent
      .then((data) => {
        console.log(data);
        res.json({ ok: true });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
  }
};

// Reset password controller
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    // console.table({ email, code, newPassword });
    const hashedPassword = await hashPassword(newPassword);

    // Reset code check
    const lostUser = await User.findOne({ email }).exec();
    if (lostUser.passwordResetCode.toString() === code) {
      const user = User.findOneAndUpdate(
        {
          passwordResetCode: code,
        },
        {
          password: hashedPassword,
          passwordResetCode: '',
        }
      ).exec();
    } else {
      return res.status(400).send('Sorry, reset code does not match!');
    }

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send('Error! Try again.');
  }
};
