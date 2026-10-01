const trackingController = require("../../../src/modules/tracking/tracking.controller");
const crowdsourceService = require("../../../src/modules/tracking/crowdsource.service");

jest.mock("../../../src/modules/tracking/crowdsource.service");

describe("Tracking Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("pingLocation", () => {
    it("should return 400 if lineId is missing", async () => {
      req.body = { lat: -23.5, lng: -46.6 };
      await trackingController.pingLocation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: true, message: 'Dados incompletos (lineId, lat, lng são obrigatórios).' });
    });

    it("should return 400 if lat is missing", async () => {
      req.body = { lineId: "123", lng: -46.6 };
      await trackingController.pingLocation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: true, message: 'Dados incompletos (lineId, lat, lng são obrigatórios).' });
    });

    it("should record passenger location and return success", async () => {
      req.body = { lineId: "123", lat: -23.5, lng: -46.6, direction: "ida", speed: 50, bearing: 90 };
      crowdsourceService.recordPassengerLocation.mockResolvedValue(true);
      
      await trackingController.pingLocation(req, res, next);
      
      expect(crowdsourceService.recordPassengerLocation).toHaveBeenCalledWith({
        ...req.body,
        deviceId: null
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("should extract deviceId from headers when present", async () => {
      req.body = { lineId: "123", lat: -23.5, lng: -46.6, direction: "ida", speed: 50, bearing: 90 };
      req.headers = { 'x-device-id': 'device-xyz-123' };
      crowdsourceService.recordPassengerLocation.mockResolvedValue(true);
      
      await trackingController.pingLocation(req, res, next);
      
      expect(crowdsourceService.recordPassengerLocation).toHaveBeenCalledWith({
        ...req.body,
        deviceId: 'device-xyz-123'
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should call next with error if crowdsourceService throws", async () => {
      req.body = { lineId: "123", lat: -23.5, lng: -46.6 };
      const error = new Error("Database error");
      crowdsourceService.recordPassengerLocation.mockRejectedValue(error);
      
      await trackingController.pingLocation(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getBus", () => {
    it("should return 400 if lineId is not provided", async () => {
      req.params = {};
      await trackingController.getBus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: true, message: 'ID da linha não fornecido.' });
    });

    it("should return 404 if no recent community data is found", async () => {
      req.params = { lineId: "123" };
      req.query = { direction: "ida" };
      crowdsourceService.getBusPosition.mockResolvedValue(null);
      
      await trackingController.getBus(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: true, message: 'Nenhuma informação comunitária recente para este ônibus.' });
    });

    it("should return 200 with data if bus position is found", async () => {
      req.params = { lineId: "123" };
      req.query = { direction: "ida" };
      const mockData = { lat: -23.5, lng: -46.6 };
      crowdsourceService.getBusPosition.mockResolvedValue(mockData);
      
      await trackingController.getBus(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("should call next with error if crowdsourceService throws", async () => {
      req.params = { lineId: "123" };
      const error = new Error("Database error");
      crowdsourceService.getBusPosition.mockRejectedValue(error);
      
      await trackingController.getBus(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
