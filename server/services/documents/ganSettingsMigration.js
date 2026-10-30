// Explicit staging migration only. It assigns no production officials or agencies.
export async function migrateGanSettings(db) {
  await db.query(`
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS authorized_official_id TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grantee_id TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gan_settings_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE grantees ADD COLUMN IF NOT EXISTS contact_title TEXT;
    ALTER TABLE grantees ADD COLUMN IF NOT EXISTS approving_official_id TEXT;
    ALTER TABLE grantees ADD COLUMN IF NOT EXISTS approving_official_name TEXT;
    ALTER TABLE grantees ADD COLUMN IF NOT EXISTS approving_official_title TEXT;
    ALTER TABLE grantees ADD COLUMN IF NOT EXISTS gan_settings_revision INTEGER NOT NULL DEFAULT 0;
    CREATE OR REPLACE FUNCTION guard_gan_organization_settings() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE changed BOOLEAN;
    BEGIN
      IF TG_OP='INSERT' THEN
        IF (NEW.authorized_official_id IS NOT NULL OR NEW.grantee_id IS NOT NULL) AND current_setting('gmt.gan_settings_action',true) IS DISTINCT FROM 'organization' THEN
          RAISE EXCEPTION 'Use the organization award-contact workflow' USING ERRCODE='42501';
        END IF;
        NEW.gan_settings_revision=0;RETURN NEW;
      END IF;
      changed=ROW(NEW.authorized_official_id,NEW.grantee_id) IS DISTINCT FROM ROW(OLD.authorized_official_id,OLD.grantee_id);
      IF changed AND current_setting('gmt.gan_settings_action',true) IS DISTINCT FROM 'organization' THEN
        RAISE EXCEPTION 'Use the organization award-contact workflow' USING ERRCODE='42501';
      END IF;
      NEW.gan_settings_revision=OLD.gan_settings_revision+CASE WHEN changed THEN 1 ELSE 0 END;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_organization_settings ON organizations;
    CREATE TRIGGER protect_gan_organization_settings BEFORE INSERT OR UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION guard_gan_organization_settings();
    CREATE OR REPLACE FUNCTION guard_gan_grantee_settings() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE changed BOOLEAN;
    BEGIN
      IF TG_OP='INSERT' THEN
        IF (NEW.approving_official_id IS NOT NULL OR NEW.approving_official_name IS NOT NULL OR NEW.approving_official_title IS NOT NULL OR NEW.contact_title IS NOT NULL)
          AND current_setting('gmt.gan_settings_action',true) IS DISTINCT FROM 'grantee' THEN
          RAISE EXCEPTION 'Use the grantee award-settings workflow' USING ERRCODE='42501';
        END IF;
        NEW.gan_settings_revision=0;RETURN NEW;
      END IF;
      IF ROW(NEW.approving_official_id,NEW.approving_official_name,NEW.approving_official_title,NEW.contact_title) IS DISTINCT FROM ROW(OLD.approving_official_id,OLD.approving_official_name,OLD.approving_official_title,OLD.contact_title)
        AND current_setting('gmt.gan_settings_action',true) IS DISTINCT FROM 'grantee' THEN
        RAISE EXCEPTION 'Use the grantee award-settings workflow' USING ERRCODE='42501';
      END IF;
      changed=ROW(NEW.name,NEW.agency_name,NEW.contact_name,NEW.contact_email,NEW.contact_phone,NEW.contact_title,NEW.approving_official_id,NEW.approving_official_name,NEW.approving_official_title,NEW.is_active)
        IS DISTINCT FROM ROW(OLD.name,OLD.agency_name,OLD.contact_name,OLD.contact_email,OLD.contact_phone,OLD.contact_title,OLD.approving_official_id,OLD.approving_official_name,OLD.approving_official_title,OLD.is_active);
      NEW.gan_settings_revision=OLD.gan_settings_revision+CASE WHEN changed THEN 1 ELSE 0 END;RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_grantee_settings ON grantees;
    CREATE TRIGGER protect_gan_grantee_settings BEFORE INSERT OR UPDATE ON grantees FOR EACH ROW EXECUTE FUNCTION guard_gan_grantee_settings();
  `);
}
