CREATE OR REPLACE FUNCTION get_unique_cylinder_volumes()
RETURNS TABLE (volume character varying)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT cylinders.volume
  FROM cylinders
  WHERE cylinders.volume IS NOT NULL;
END;
$$;
