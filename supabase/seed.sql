-- ==============================================
-- MathMuse Database Schema & Seed Data
-- Run this in your Supabase SQL Editor
-- ==============================================

-- 1. Create categories table
-- ==============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create category_problems junction table
-- ==============================================
CREATE TABLE IF NOT EXISTS category_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  level_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, level_number)
);

-- 3. Create user_progress table
-- ==============================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  level_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category_id, level_number)
);

-- 4. Enable RLS on user_progress
-- ==============================================
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own progress" ON user_progress;
CREATE POLICY "Users manage own progress" ON user_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow reading categories (public)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories are public" ON categories;
CREATE POLICY "Categories are public" ON categories FOR SELECT USING (true);

-- Allow reading category_problems (public)
ALTER TABLE category_problems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Category problems are public" ON category_problems;
CREATE POLICY "Category problems are public" ON category_problems FOR SELECT USING (true);

-- ==============================================
-- SEED DATA
-- ==============================================

-- Insert 5 Categories
-- ==============================================
INSERT INTO categories (id, name, description, color, display_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Basic Equations', 'Master one-step equations to build a strong foundation', '#10B981', 1),
  ('22222222-2222-2222-2222-222222222222', 'Linear Equations', 'Solve multi-step equations with variables on both sides', '#3B82F6', 2),
  ('33333333-3333-3333-3333-333333333333', 'Systems of Equations', 'Tackle two equations with two unknowns', '#8B5CF6', 3),
  ('44444444-4444-4444-4444-444444444444', 'Quadratic Equations', 'Learn factoring and the quadratic formula', '#F59E0B', 4),
  ('55555555-5555-5555-5555-555555555555', 'Inequalities', 'Work with less than, greater than, and compound inequalities', '#EF4444', 5)
ON CONFLICT DO NOTHING;

-- Insert 50 Problems (10 per category)
-- ==============================================

-- Basic Equations (Category 1) - Levels 1-10 (easiest to harder)
INSERT INTO problems (id, title, body) VALUES
  ('a1111111-0001-0001-0001-000000000001', 'Basic 1', 'x + 3 = 7'),
  ('a1111111-0001-0001-0001-000000000002', 'Basic 2', 'x - 5 = 2'),
  ('a1111111-0001-0001-0001-000000000003', 'Basic 3', '4 + x = 9'),
  ('a1111111-0001-0001-0001-000000000004', 'Basic 4', '2x = 8'),
  ('a1111111-0001-0001-0001-000000000005', 'Basic 5', 'x/3 = 4'),
  ('a1111111-0001-0001-0001-000000000006', 'Basic 6', '5x = 25'),
  ('a1111111-0001-0001-0001-000000000007', 'Basic 7', 'x + 12 = 20'),
  ('a1111111-0001-0001-0001-000000000008', 'Basic 8', '3x = 21'),
  ('a1111111-0001-0001-0001-000000000009', 'Basic 9', 'x/4 = 6'),
  ('a1111111-0001-0001-0001-000000000010', 'Basic 10', '7x = 49')
ON CONFLICT DO NOTHING;

-- Linear Equations (Category 2) - Levels 1-10
INSERT INTO problems (id, title, body) VALUES
  ('a2222222-0002-0002-0002-000000000001', 'Linear 1', '2x + 3 = 7'),
  ('a2222222-0002-0002-0002-000000000002', 'Linear 2', '3x - 4 = 8'),
  ('a2222222-0002-0002-0002-000000000003', 'Linear 3', '4x + 5 = 21'),
  ('a2222222-0002-0002-0002-000000000004', 'Linear 4', '5x - 2 = 18'),
  ('a2222222-0002-0002-0002-000000000005', 'Linear 5', '2x + 6 = 3x - 1'),
  ('a2222222-0002-0002-0002-000000000006', 'Linear 6', '4x - 3 = 2x + 9'),
  ('a2222222-0002-0002-0002-000000000007', 'Linear 7', '3(x + 2) = 15'),
  ('a2222222-0002-0002-0002-000000000008', 'Linear 8', '2(x - 4) = x + 1'),
  ('a2222222-0002-0002-0002-000000000009', 'Linear 9', '5x + 3 = 2x + 12'),
  ('a2222222-0002-0002-0002-000000000010', 'Linear 10', '4(x - 1) = 2(x + 3)')
ON CONFLICT DO NOTHING;

-- Systems of Equations (Category 3) - Levels 1-10
INSERT INTO problems (id, title, body) VALUES
  ('a3333333-0003-0003-0003-000000000001', 'Systems 1', 'x + y = 5, x - y = 1'),
  ('a3333333-0003-0003-0003-000000000002', 'Systems 2', '2x + y = 7, x - y = 2'),
  ('a3333333-0003-0003-0003-000000000003', 'Systems 3', 'x + 2y = 8, x - y = 2'),
  ('a3333333-0003-0003-0003-000000000004', 'Systems 4', '3x + y = 10, x + y = 4'),
  ('a3333333-0003-0003-0003-000000000005', 'Systems 5', '2x + 3y = 12, x + y = 5'),
  ('a3333333-0003-0003-0003-000000000006', 'Systems 6', 'x + 4y = 14, 2x - y = 1'),
  ('a3333333-0003-0003-0003-000000000007', 'Systems 7', '3x + 2y = 16, x - y = 1'),
  ('a3333333-0003-0003-0003-000000000008', 'Systems 8', '4x + y = 18, 2x + 3y = 14'),
  ('a3333333-0003-0003-0003-000000000009', 'Systems 9', '5x - 2y = 11, 3x + y = 13'),
  ('a3333333-0003-0003-0003-000000000010', 'Systems 10', '2x + 5y = 24, 4x - y = 10')
ON CONFLICT DO NOTHING;

-- Quadratic Equations (Category 4) - Levels 1-10
INSERT INTO problems (id, title, body) VALUES
  ('a4444444-0004-0004-0004-000000000001', 'Quadratic 1', 'x² = 9'),
  ('a4444444-0004-0004-0004-000000000002', 'Quadratic 2', 'x² = 16'),
  ('a4444444-0004-0004-0004-000000000003', 'Quadratic 3', 'x² - 4 = 0'),
  ('a4444444-0004-0004-0004-000000000004', 'Quadratic 4', 'x² + 2x = 0'),
  ('a4444444-0004-0004-0004-000000000005', 'Quadratic 5', 'x² - 5x + 6 = 0'),
  ('a4444444-0004-0004-0004-000000000006', 'Quadratic 6', 'x² + 3x - 10 = 0'),
  ('a4444444-0004-0004-0004-000000000007', 'Quadratic 7', '2x² - 8 = 0'),
  ('a4444444-0004-0004-0004-000000000008', 'Quadratic 8', 'x² - 6x + 9 = 0'),
  ('a4444444-0004-0004-0004-000000000009', 'Quadratic 9', 'x² + 4x + 4 = 0'),
  ('a4444444-0004-0004-0004-000000000010', 'Quadratic 10', '2x² + 5x - 3 = 0')
ON CONFLICT DO NOTHING;

-- Inequalities (Category 5) - Levels 1-10
INSERT INTO problems (id, title, body) VALUES
  ('a5555555-0005-0005-0005-000000000001', 'Inequality 1', 'x + 2 > 5'),
  ('a5555555-0005-0005-0005-000000000002', 'Inequality 2', 'x - 3 < 4'),
  ('a5555555-0005-0005-0005-000000000003', 'Inequality 3', '2x ≥ 6'),
  ('a5555555-0005-0005-0005-000000000004', 'Inequality 4', '3x ≤ 12'),
  ('a5555555-0005-0005-0005-000000000005', 'Inequality 5', 'x + 5 > 2x - 1'),
  ('a5555555-0005-0005-0005-000000000006', 'Inequality 6', '4x - 2 ≤ 10'),
  ('a5555555-0005-0005-0005-000000000007', 'Inequality 7', '2x + 3 < x + 8'),
  ('a5555555-0005-0005-0005-000000000008', 'Inequality 8', '5x - 4 ≥ 3x + 2'),
  ('a5555555-0005-0005-0005-000000000009', 'Inequality 9', '-2x + 6 > 0'),
  ('a5555555-0005-0005-0005-000000000010', 'Inequality 10', '3(x - 1) ≤ 2(x + 2)')
ON CONFLICT DO NOTHING;

-- Link Problems to Categories
-- ==============================================

-- Basic Equations links
INSERT INTO category_problems (category_id, problem_id, level_number) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000001', 1),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000002', 2),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000003', 3),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000004', 4),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000005', 5),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000006', 6),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000007', 7),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000008', 8),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000009', 9),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0001-0001-0001-000000000010', 10)
ON CONFLICT DO NOTHING;

-- Linear Equations links
INSERT INTO category_problems (category_id, problem_id, level_number) VALUES
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000001', 1),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000002', 2),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000003', 3),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000004', 4),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000005', 5),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000006', 6),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000007', 7),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000008', 8),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000009', 9),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-0002-0002-0002-000000000010', 10)
ON CONFLICT DO NOTHING;

-- Systems of Equations links
INSERT INTO category_problems (category_id, problem_id, level_number) VALUES
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000001', 1),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000002', 2),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000003', 3),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000004', 4),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000005', 5),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000006', 6),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000007', 7),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000008', 8),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000009', 9),
  ('33333333-3333-3333-3333-333333333333', 'a3333333-0003-0003-0003-000000000010', 10)
ON CONFLICT DO NOTHING;

-- Quadratic Equations links
INSERT INTO category_problems (category_id, problem_id, level_number) VALUES
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000001', 1),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000002', 2),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000003', 3),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000004', 4),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000005', 5),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000006', 6),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000007', 7),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000008', 8),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000009', 9),
  ('44444444-4444-4444-4444-444444444444', 'a4444444-0004-0004-0004-000000000010', 10)
ON CONFLICT DO NOTHING;

-- Inequalities links
INSERT INTO category_problems (category_id, problem_id, level_number) VALUES
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000001', 1),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000002', 2),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000003', 3),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000004', 4),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000005', 5),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000006', 6),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000007', 7),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000008', 8),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000009', 9),
  ('55555555-5555-5555-5555-555555555555', 'a5555555-0005-0005-0005-000000000010', 10)
ON CONFLICT DO NOTHING;

-- Done!
-- ==============================================
SELECT 'Seed complete! Created:' AS status;
SELECT COUNT(*) AS category_count FROM categories;
SELECT COUNT(*) AS problem_count FROM problems;
SELECT COUNT(*) AS category_problem_links FROM category_problems;
