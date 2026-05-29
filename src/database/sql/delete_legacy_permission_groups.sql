-- Xóa nhóm quyền cũ (tên tự do, không theo key @group:<phong-ban>:<vi-tri>)
DELETE FROM app_roles
WHERE type = 'group'
  AND name NOT LIKE '@group:%';
