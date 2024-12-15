const express = require("express");
const router = express.Router();
/*const { verifyToken } = require("../models/models");
router.all("/api/accounts/verify", async (req, res) => {
  console.log(req.body);
  console.log(req.method);
  console.log(res);
  if (req.method !== "POST") {
    return res.status(405).json({ code: 405, message: "Method Not Allowed" });
  }
  console.log(req.body);
  if (!req.body.token) {
    return res
      .status(400)
      .json({ code: 400, message: "Missing code parameter" });
  }
  if (!req.body.userId) {
    return res
      .status(400)
      .json({ code: 400, message: "Missing userId parameter" });
  }
  if (!req.body.playerName) {
    return res
      .status(400)
      .json({ code: 400, message: "Missing playerName parameter" });
  }
  const response = await verifyToken(req.body);
  return res.status(response.status).send(response.message);
});
*/
module.exports = router;
