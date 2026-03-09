import express from 'express';
import { supabase } from '../lib/supabase.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /parent-login
 * Email + password login via Supabase Auth
 * Body: { email, password }
 * Returns: { token, parent: { id, email, display_name }, children: [...] }
 */
router.post('/parent-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    const { user } = data;

    // Fetch parent details from database
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, email, display_name')
      .eq('auth_id', user.id)
      .single();

    if (parentError) {
      return res.status(404).json({ error: 'Parent record not found' });
    }

    // Fetch children associated with this parent
    const { data: childrenData, error: childrenError } = await supabase
      .from('students')
      .select('id, name, age, level')
      .eq('parent_id', parentData.id);

    if (childrenError && childrenError.code !== 'PGRST116') {
      return res.status(500).json({ error: childrenError.message });
    }

    // Generate JWT token with parent info
    const token = generateToken({
      parentId: parentData.id,
      email: parentData.email,
      type: 'parent',
    });

    return res.status(200).json({
      token,
      parent: parentData,
      children: childrenData || [],
    });
  } catch (err) {
    console.error('Parent login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /child-select
 * Select a child for session (no auth needed, returns session token)
 * Body: { studentId }
 * Returns: { token, student: { id, name, age, level } }
 */
router.post('/child-select', async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Fetch student details
    const { data: student, error } = await supabase
      .from('students')
      .select('id, name, age, level')
      .eq('id', studentId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Generate JWT token with student info
    const token = generateToken({
      studentId: student.id,
      name: student.name,
      type: 'student',
    });

    return res.status(200).json({
      token,
      student,
    });
  } catch (err) {
    console.error('Child select error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
