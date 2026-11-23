-- NULL is an unconfigured suggestion; the default for new records is unchanged.
ALTER TABLE grupos_produto ALTER COLUMN margem_sugerida DROP NOT NULL;
