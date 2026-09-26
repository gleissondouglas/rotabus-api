const { Queue } = require("bullmq");
const { connection } = require("./bullmq.config");

const REMINDERS_QUEUE_NAME = "push-reminders";

const remindersQueue = new Queue(REMINDERS_QUEUE_NAME, { connection });

module.exports = {
  remindersQueue,
  REMINDERS_QUEUE_NAME,
};
