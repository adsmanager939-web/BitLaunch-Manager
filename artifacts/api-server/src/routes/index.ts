import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bitlaunchRouter from "./bitlaunch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bitlaunchRouter);

export default router;
