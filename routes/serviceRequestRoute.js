import express from "express";
import {
  createServiceRequest,
  getServiceRequests,
} from "../controller/serviceRequestController.js";

const serviceReqRouter = express.Router();

serviceReqRouter.post("/", createServiceRequest);
serviceReqRouter.get("/", getServiceRequests);

export default serviceReqRouter;
