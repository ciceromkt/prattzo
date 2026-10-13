#!/bin/sh
# Recria o banco do zero e aplica ambiente + migrações. Uso: sh supabase/teste/recriar.sh
set -e
PGH="-h /tmp -p 5433 -U postgres"
dropdb $PGH --if-exists pede_esse
createdb $PGH pede_esse
for f in supabase/teste/00_ambiente_supabase.sql supabase/migrations/20261012000100_schema.sql \
         supabase/migrations/20261012000200_rls.sql supabase/migrations/20261012000300_metricas_storage.sql supabase/migrations/20261012000400_ordem_atomica.sql supabase/migrations/20261012000500_versao_linha.sql; do
  psql $PGH -d pede_esse -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done
echo "banco recriado"
