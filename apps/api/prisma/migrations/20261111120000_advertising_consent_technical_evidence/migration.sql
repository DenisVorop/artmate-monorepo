ALTER TABLE apply_consent_decision_commands ADD COLUMN advertising_device JSONB;

ALTER TABLE email_advertising_consent_events
  ADD COLUMN client_ip_address VARCHAR(45),
  ADD COLUMN client_time_zone VARCHAR(64),
  ADD COLUMN client_utc_offset_minutes INTEGER,
  ADD COLUMN browser_name VARCHAR(64),
  ADD COLUMN browser_version VARCHAR(64),
  ADD COLUMN os_name VARCHAR(64),
  ADD COLUMN os_version VARCHAR(64),
  ADD CONSTRAINT advertising_technical_evidence_auth_grant CHECK (
    (action = 'granted' AND auth_operation_id IS NOT NULL)
    OR (client_ip_address IS NULL AND client_time_zone IS NULL
        AND client_utc_offset_minutes IS NULL AND browser_name IS NULL
        AND browser_version IS NULL AND os_name IS NULL AND os_version IS NULL)
  );
