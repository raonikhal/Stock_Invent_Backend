const jwt = require("jsonwebtoken");

// 1. Standard Authentication Middleware
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing!",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret_key_123"
    );

    // Decoded object contains: shopId, shopCode, phone, role, userId
    req.user = decoded; 

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token!",
      error: error.message,
    });
  }
};

// 2. Role-based Permission Middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ 
        success: false, 
        message: "User role missing in token." 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not an Owner" 
      });
    }
    
    next();
  };
};

module.exports = { protect, authorizeRoles };