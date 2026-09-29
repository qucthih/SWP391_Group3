import { Router } from "express";
import { loginWithGoogle, getCurrentUser } from "../controllers/auth.controller.js";
import { authenticateJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/google", loginWithGoogle);
router.get("/me", authenticateJWT, getCurrentUser);

export default router;
