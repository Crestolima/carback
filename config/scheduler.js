// scheduler.js
const cron = require('node-cron');
const { scheduledStatusUpdate } = require('./controllers/bookingController');

// Schedule task to run at midnight every day
// The cron expression '0 0 * * *' means:
// - 0 minutes
// - 0 hours (midnight)
// - every day of the month (*)
// - every month (*)
// - every day of the week (*)

const setupScheduler = () => {
  console.log('📅 Setting up booking status update scheduler');
  
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running daily booking status update job');
    try {
      const result = await scheduledStatusUpdate();
      console.log(`✅ Status update job completed. Updated ${result.updatedCount} bookings.`);
    } catch (error) {
      console.error('❌ Status update job failed:', error);
    }
  });
  
  console.log('✅ Scheduler setup complete');
};

module.exports = { setupScheduler };