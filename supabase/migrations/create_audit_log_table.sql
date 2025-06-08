-- Create audit log table for scraping compliance tracking
-- This table maintains a complete audit trail of all scraping activities
-- to ensure compliance with ethical scraping standards

CREATE TABLE IF NOT EXISTS scraping_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'scrape_success', 'rate_limited', 'proxy_validation'
    url TEXT NOT NULL, -- The URL that was accessed
    status_code INTEGER NOT NULL, -- HTTP status code
    response_time_ms INTEGER NOT NULL, -- Response time in milliseconds
    source VARCHAR(50) NOT NULL, -- Source identifier (autotrader, cars_com, etc.)
    
    -- Vehicle context (optional)
    make VARCHAR(50),
    model VARCHAR(50),
    year INTEGER,
    
    -- Proxy and cache information
    proxy_used VARCHAR(100), -- IP:PORT of proxy used or 'direct'
    cache_hit BOOLEAN DEFAULT FALSE,
    
    -- Error tracking
    error TEXT, -- Error message if applicable
    
    -- Compliance information
    user_agent TEXT NOT NULL,
    compliance_notes TEXT DEFAULT 'Public data only, no personal info collected',
    
    -- Indexes for common queries
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_action (action),
    INDEX idx_audit_source (source),
    INDEX idx_audit_vehicle (make, model, year),
    INDEX idx_audit_status (status_code)
);

-- Add RLS policy (Row Level Security)
ALTER TABLE scraping_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage audit logs
CREATE POLICY "Service role can manage audit logs" ON scraping_audit_log
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE scraping_audit_log IS 'Audit log for web scraping activities to ensure compliance with ethical scraping standards';
COMMENT ON COLUMN scraping_audit_log.action IS 'Type of action performed (scrape_success, rate_limited, etc.)';
COMMENT ON COLUMN scraping_audit_log.url IS 'The URL that was accessed during scraping';
COMMENT ON COLUMN scraping_audit_log.source IS 'Source website identifier (autotrader, cars_com, ebay_motors, cargurus)';
COMMENT ON COLUMN scraping_audit_log.proxy_used IS 'Proxy server used or "direct" for direct connection';
COMMENT ON COLUMN scraping_audit_log.compliance_notes IS 'Notes documenting compliance with data protection standards';

-- Create view for compliance reporting
CREATE VIEW compliance_audit_summary AS
SELECT 
    source,
    action,
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as request_count,
    AVG(response_time_ms) as avg_response_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
    COUNT(CASE WHEN cache_hit THEN 1 END) as cache_hits,
    COUNT(DISTINCT proxy_used) as unique_proxies_used
FROM scraping_audit_log 
GROUP BY source, action, DATE_TRUNC('day', timestamp)
ORDER BY date DESC, source, action;

COMMENT ON VIEW compliance_audit_summary IS 'Daily summary of scraping activities for compliance monitoring'; 