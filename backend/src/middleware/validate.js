const { validationResult } = require('express-validator');

// express-validator only collects errors; without this middleware the rules
// declared on a route are silently ignored. Mount it after the rule chain.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return next(new Error(errors.array().map((e) => e.msg).join(', ')));
  }
  next();
};

module.exports = validate;
