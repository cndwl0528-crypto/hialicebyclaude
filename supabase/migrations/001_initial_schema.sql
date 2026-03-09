-- ============================================================================
-- HiAlice Initial Schema Migration
-- Project: HiAlice - Interactive English Reading App for Children (6-13)
-- Version: 1.0
-- Date: 2026-03-09
-- ============================================================================

-- ============================================================================
-- ENUMS (Custom Types)
-- ============================================================================

CREATE TYPE learning_level AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TYPE session_stage AS ENUM ('title', 'introduction', 'body', 'conclusion');

CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned');

CREATE TYPE speaker_type AS ENUM ('alice', 'student');

CREATE TYPE part_of_speech AS ENUM ('noun', 'verb', 'adjective', 'adverb', 'other');

-- ============================================================================
-- PARENTS TABLE
-- ============================================================================
-- Linked to Supabase Auth (auth.users)
-- Stores parent/guardian information

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT email_format CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_parents_auth_id ON parents(auth_id);
CREATE INDEX idx_parents_email ON parents(email);

-- ============================================================================
-- STUDENTS TABLE
-- ============================================================================
-- Stores student information linked to parents

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  age INT NOT NULL,
  level learning_level NOT NULL DEFAULT 'beginner',
  avatar_emoji VARCHAR(10) DEFAULT '👦',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT age_range CHECK (age >= 6 AND age <= 13)
);

CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_level ON students(level);

-- ============================================================================
-- BOOKS TABLE
-- ============================================================================
-- Stores library of books for reading sessions

CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255) NOT NULL,
  level learning_level NOT NULL,
  genre VARCHAR(100),
  cover_emoji VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  page_count INT NOT NULL DEFAULT 1,
  published_year INT,
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT page_count_positive CHECK (page_count > 0)
);

CREATE INDEX idx_books_level ON books(level);
CREATE INDEX idx_books_is_active ON books(is_active);
CREATE INDEX idx_books_genre ON books(genre);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
-- Stores reading review sessions (Q&A sessions after reading a book)

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE RESTRICT NOT NULL,
  stage session_stage NOT NULL DEFAULT 'title',
  status session_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  level_score INT DEFAULT NULL,
  grammar_score INT DEFAULT NULL,
  image_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT level_score_range CHECK (level_score IS NULL OR (level_score >= 0 AND level_score <= 100)),
  CONSTRAINT grammar_score_range CHECK (grammar_score IS NULL OR (grammar_score >= 0 AND grammar_score <= 100)),
  CONSTRAINT completed_after_started CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX idx_sessions_student_id ON sessions(student_id);
CREATE INDEX idx_sessions_book_id ON sessions(book_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_stage ON sessions(stage);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- ============================================================================
-- DIALOGUES TABLE
-- ============================================================================
-- Stores turn-by-turn conversation between HiAlice and student

CREATE TABLE dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  stage session_stage NOT NULL,
  turn INT NOT NULL,
  speaker speaker_type NOT NULL,
  content TEXT NOT NULL,
  grammar_score INT,
  lexical_complexity INT DEFAULT 0,
  response_length INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT grammar_score_range CHECK (grammar_score IS NULL OR (grammar_score >= 0 AND grammar_score <= 100)),
  CONSTRAINT lexical_complexity_range CHECK (lexical_complexity >= 0 AND lexical_complexity <= 100),
  CONSTRAINT response_length_positive CHECK (response_length >= 0),
  CONSTRAINT turn_positive CHECK (turn > 0)
);

CREATE INDEX idx_dialogues_session_id ON dialogues(session_id);
CREATE INDEX idx_dialogues_stage ON dialogues(stage);
CREATE INDEX idx_dialogues_speaker ON dialogues(speaker);
CREATE INDEX idx_dialogues_created_at ON dialogues(created_at);

-- ============================================================================
-- VOCABULARY TABLE
-- ============================================================================
-- Tracks vocabulary learned by each student during sessions

CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  word VARCHAR(255) NOT NULL,
  context_sentence TEXT NOT NULL,
  synonyms TEXT[] DEFAULT ARRAY[]::TEXT[],
  antonyms TEXT[] DEFAULT ARRAY[]::TEXT[],
  pos part_of_speech NOT NULL DEFAULT 'other',
  first_used TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used TIMESTAMPTZ DEFAULT now(),
  mastery_level INT DEFAULT 1 NOT NULL,
  use_count INT DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT mastery_level_range CHECK (mastery_level >= 1 AND mastery_level <= 5),
  CONSTRAINT use_count_positive CHECK (use_count >= 1),
  CONSTRAINT word_not_empty CHECK (LENGTH(TRIM(word)) > 0)
);

CREATE INDEX idx_vocabulary_student_id ON vocabulary(student_id);
CREATE INDEX idx_vocabulary_word ON vocabulary(LOWER(word));
CREATE INDEX idx_vocabulary_session_id ON vocabulary(session_id);
CREATE INDEX idx_vocabulary_mastery_level ON vocabulary(mastery_level);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARENTS RLS POLICIES
-- ============================================================================

-- Parents can only view/update their own profile
CREATE POLICY "parents_can_view_own_profile"
  ON parents FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY "parents_can_update_own_profile"
  ON parents FOR UPDATE
  USING (auth_id = auth.uid());

-- ============================================================================
-- STUDENTS RLS POLICIES
-- ============================================================================

-- Students are viewable by their parent
CREATE POLICY "parents_can_view_own_students"
  ON students FOR SELECT
  USING (parent_id IN (
    SELECT id FROM parents WHERE auth_id = auth.uid()
  ));

-- Parents can insert students for themselves
CREATE POLICY "parents_can_create_students"
  ON students FOR INSERT
  WITH CHECK (parent_id IN (
    SELECT id FROM parents WHERE auth_id = auth.uid()
  ));

-- Parents can update their own students
CREATE POLICY "parents_can_update_own_students"
  ON students FOR UPDATE
  USING (parent_id IN (
    SELECT id FROM parents WHERE auth_id = auth.uid()
  ));

-- ============================================================================
-- BOOKS RLS POLICIES
-- ============================================================================

-- All authenticated users can view active books
CREATE POLICY "authenticated_can_view_active_books"
  ON books FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- SESSIONS RLS POLICIES
-- ============================================================================

-- Parents can view sessions of their students
CREATE POLICY "parents_can_view_student_sessions"
  ON sessions FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- Parents can create sessions for their students
CREATE POLICY "parents_can_create_sessions"
  ON sessions FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- Parents can update sessions of their students
CREATE POLICY "parents_can_update_student_sessions"
  ON sessions FOR UPDATE
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- ============================================================================
-- DIALOGUES RLS POLICIES
-- ============================================================================

-- Parents can view dialogues of their students' sessions
CREATE POLICY "parents_can_view_student_dialogues"
  ON dialogues FOR SELECT
  USING (session_id IN (
    SELECT id FROM sessions WHERE student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
  ));

-- Parents can create dialogues for their students' sessions
CREATE POLICY "parents_can_create_dialogues"
  ON dialogues FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM sessions WHERE student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
  ));

-- ============================================================================
-- VOCABULARY RLS POLICIES
-- ============================================================================

-- Parents can view vocabulary of their students
CREATE POLICY "parents_can_view_student_vocabulary"
  ON vocabulary FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- Parents can create vocabulary entries for their students
CREATE POLICY "parents_can_create_vocabulary"
  ON vocabulary FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- ============================================================================
-- SEED DATA: BOOKS
-- ============================================================================

-- Beginner Level Books (3)
INSERT INTO books (title, author, level, genre, cover_emoji, description, page_count, published_year)
VALUES
  (
    'Where the Wild Things Are',
    'Maurice Sendak',
    'beginner',
    'Picture Book',
    '🌙',
    'A magical adventure story about a boy named Max who travels to an island inhabited by wild creatures.',
    48,
    1963
  ),
  (
    'The Very Hungry Caterpillar',
    'Eric Carle',
    'beginner',
    'Picture Book',
    '🐛',
    'A delightful tale of a tiny caterpillar''s journey as it eats its way through the week before transforming into a butterfly.',
    32,
    1969
  ),
  (
    'Corduroy',
    'Don Freeman',
    'beginner',
    'Picture Book',
    '🧸',
    'A touching story about a toy bear''s desire to be loved and his search for a home with a family.',
    64,
    1968
  );

-- Intermediate Level Books (4)
INSERT INTO books (title, author, level, genre, cover_emoji, description, page_count, published_year)
VALUES
  (
    'Charlotte''s Web',
    'E.B. White',
    'intermediate',
    'Chapter Book',
    '🕸️',
    'A timeless tale of friendship between a pig named Wilbur and a clever spider named Charlotte who saves his life through her web.',
    184,
    1952
  ),
  (
    'The Magic Tree House: Dinosaurs Before Dark',
    'Mary Pope Osborne',
    'intermediate',
    'Chapter Book',
    '🌳',
    'Jack and Annie discover a magical tree house that transports them to different times in history, starting with the age of dinosaurs.',
    144,
    1992
  ),
  (
    'Winnie-the-Pooh',
    'A.A. Milne',
    'intermediate',
    'Chapter Book',
    '🐻',
    'Charming stories of a beloved bear and his friends in the Hundred Acre Wood, including Piglet, Eeyore, and Tigger.',
    160,
    1926
  ),
  (
    'Bridge to Terabithia',
    'Katherine Paterson',
    'intermediate',
    'Chapter Book',
    '🌉',
    'A story about two imaginative children who create a secret fantasy world called Terabithia and learn the value of friendship.',
    163,
    1977
  );

-- Advanced Level Books (3)
INSERT INTO books (title, author, level, genre, cover_emoji, description, page_count, published_year)
VALUES
  (
    'Percy Jackson and the Olympians: The Lightning Thief',
    'Rick Riordan',
    'advanced',
    'Middle Grade Novel',
    '⚡',
    'A thrilling adventure about a boy who discovers he is the son of a Greek god and must prevent a war among the gods.',
    375,
    2005
  ),
  (
    'The Tale of Despereaux: Being the Story of a Mouse, a Princess, and a Dragon',
    'Kate DiCamillo',
    'advanced',
    'Middle Grade Novel',
    '🐭',
    'An enchanting story of a small mouse with big dreams who falls in love with a princess and embarks on a daring rescue mission.',
    268,
    2003
  ),
  (
    'The Wizard of Oz',
    'L. Frank Baum',
    'advanced',
    'Middle Grade Novel',
    '🌈',
    'A classic fantasy adventure where Dorothy and her companions journey along the Yellow Brick Road to meet the mysterious Wizard of Oz.',
    250,
    1900
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_sessions_student_book ON sessions(student_id, book_id);
CREATE INDEX idx_vocabulary_student_word ON vocabulary(student_id, LOWER(word));
CREATE INDEX idx_dialogues_session_speaker ON dialogues(session_id, speaker);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema initialization successful.
-- All tables, enums, constraints, RLS policies, and seed data have been created.
-- Ready for application deployment.
