-- Add admin role for AGR Consultoria user
INSERT INTO user_roles (user_id, role)
VALUES ('1aa32506-86d3-48a6-b1f4-91adac798506', 'admin');

-- Add user role for other users
INSERT INTO user_roles (user_id, role)
SELECT id, 'user'::app_role FROM usuarios
WHERE id NOT IN (SELECT user_id FROM user_roles WHERE role = 'user')
  AND id != '1aa32506-86d3-48a6-b1f4-91adac798506';