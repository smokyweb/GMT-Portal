import {createGanReturnsRouter} from '../../routes/ganReturns.js';
import {createGanWorkflowRouter} from '../../routes/ganWorkflow.js';
import {createGanPackageRouter} from '../../routes/ganPackages.js';
import {createGanSettingsRouter} from '../../routes/ganSettings.js';
import {createGanDraftRouter} from '../../routes/ganDrafts.js';
import {createGanBatchRouter} from '../../routes/ganBatches.js';
import {createGanPreviewRouter} from '../../routes/ganPreview.js';
import {createGanWorkflowNotificationAccess} from '../../middleware/ganWorkflowNotificationAccess.js';
import {createGanWorkflowRuleAccess} from '../../middleware/ganWorkflowRuleAccess.js';
import {createGanDocumentEntityAccess} from '../../middleware/ganDocumentEntityAccess.js';
import {createGanSettingsEntityAccess} from '../../middleware/ganSettingsEntityAccess.js';
import {migrateGanSettings} from './ganSettingsMigration.js';
import {migrateGanDrafts} from './ganDraftMigration.js';
import {migrateGanBatches} from './ganBatchMigration.js';
import {migrateGanPackages} from './ganPackageMigration.js';
import {migrateGanWorkflow} from './ganWorkflowMigration.js';
import {migrateGanReturns} from './ganReturnMigration.js';

export function configureGanRuntime(app,db,authenticate) {
  app.use('/api/gan',createGanReturnsRouter(db,authenticate));
  app.use('/api/gan',createGanWorkflowRouter(db,authenticate));
  app.use('/api/gan',createGanPackageRouter(db,authenticate));
  app.use('/api/gan/settings',createGanSettingsRouter(db,authenticate));
  app.use('/api/gan',createGanDraftRouter(db,authenticate));
  app.use('/api/gan',createGanBatchRouter(db,authenticate));
  app.use('/api/gan',createGanPreviewRouter(db,authenticate));
  app.use('/api/entities/:entity/:id?',authenticate,
    createGanWorkflowNotificationAccess(db),createGanWorkflowRuleAccess(db),
    createGanDocumentEntityAccess(db),createGanSettingsEntityAccess(db));
}

export async function migrateGanRuntime(pool) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':gan-runtime-migration'))");
    await db.query('CREATE TABLE IF NOT EXISTS gmt_runtime_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied=await db.query("SELECT name FROM gmt_runtime_migrations WHERE name='gan-runtime-v1'");
    if(!applied.rows.length) {
      await migrateGanSettings(db);
      await migrateGanDrafts(db);
      await migrateGanBatches(db);
      await migrateGanPackages(db);
      await migrateGanWorkflow(db);
      await migrateGanReturns(db);
      await db.query("INSERT INTO gmt_runtime_migrations(name) VALUES('gan-runtime-v1')");
    }
    await db.query('COMMIT');
  } catch(error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
