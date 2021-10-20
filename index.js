import express from 'express';
import cors from 'cors';
import { readdirSync } from 'fs';
import mongoose from 'mongoose';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
const morgan = require('morgan');
require('dotenv').config();

const csrfProtection = csrf({ cookie: true });

// Express app initialized
const app = express();

// Database
mongoose
  .connect(process.env.DATABASE)
  .then(() => console.log('**Database connected!**'))
  .catch((err) =>
    console.log('Database connection error! Check server end-point. ', err)
  );

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Routes auto-importing middleware
readdirSync('./routes').map((r) => {
  app.use('/api', require(`./routes/${r}`));
});

// CSRF
app.use(csrfProtection);

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Port
const port = process.env.PORT || 8000;

app.listen(port, () => console.log(`Server is running on PORT ${port}`));
