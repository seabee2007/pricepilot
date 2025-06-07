-- Setup automatic price alerts using pg_cron
-- This will run the price alerts check every hour

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to trigger price alerts via HTTP
CREATE OR REPLACE FUNCTION trigger_price_alerts_http()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT;
  result record;
BEGIN
  -- Construct the function URL
  function_url := 'https://aaootfztturzzvuvdlfy.supabase.co/functions/v1/check-price-alerts';
  
  -- Log the cron job execution
  RAISE LOG 'Starting scheduled price alerts check at %', now();
  
  -- Make HTTP request to the edge function
  -- Note: This requires the http extension and proper configuration
  BEGIN
    SELECT * INTO result FROM http_post(
      function_url,
      '{}',
      'application/json',
      ARRAY[
        http_header('apikey', current_setting('app.supabase_anon_key', true)),
        http_header('Content-Type', 'application/json')
      ]
    );
    
    IF result.status = 200 THEN
      RAISE LOG 'Price alerts check completed successfully';
    ELSE
      RAISE WARNING 'Price alerts check failed with status: %', result.status;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error calling price alerts function: %', SQLERRM;
  END;
  
END;
$$;

-- For now, let's create a simpler version that just logs
-- You can manually trigger the edge function or set up external cron
CREATE OR REPLACE FUNCTION log_price_alerts_schedule()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE LOG 'Price alerts scheduled check at % - Use manual trigger in app', now();
  
  -- Insert a log entry that could trigger external monitoring
  INSERT INTO price_history (query, avg_price, timestamp) 
  VALUES ('_cron_trigger_', 0, now())
  ON CONFLICT DO NOTHING;
  
END;
$$;

-- Schedule the logging function to run every hour
-- This creates a log entry you can monitor to trigger external automation
SELECT cron.schedule(
  'price-alerts-log',
  '0 * * * *',                          -- every hour at minute 0
  'SELECT log_price_alerts_schedule();'
);

-- Alternative: Schedule to run twice daily (8 AM and 8 PM UTC)
-- SELECT cron.schedule('price-alerts-twice-daily', '0 8,20 * * *', 'SELECT log_price_alerts_schedule();');

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_price_alerts_http() TO postgres;
GRANT EXECUTE ON FUNCTION log_price_alerts_schedule() TO postgres;

-- View current cron jobs
-- You can run this query to see active jobs: SELECT * FROM cron.job;

-- To manually run the HTTP trigger (if http extension is available):
-- SELECT trigger_price_alerts_http();

COMMENT ON FUNCTION trigger_price_alerts_http() IS 'Triggers price alerts via HTTP call to edge function';
COMMENT ON FUNCTION log_price_alerts_schedule() IS 'Logs scheduled price alert checks for external monitoring'; 