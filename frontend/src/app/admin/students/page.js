'use client';

import React, { useState, useEffect } from 'react';

// Mock data
const MOCK_STUDENTS = [
  {
    id: 1,
    name: 'Alice',
    age: 8,
    level: 'Beginner',
    booksRead: 5,
    avgGrammar: 85,
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    email: 'alice.parent@example.com',
    readingHistory: [
      { title: 'The Very Hungry Caterpillar', completedAt: new Date(Date.now() - 3600000).toISOString() },
      { title: 'Where the Wild Things Are', completedAt: new Date(Date.now() - 86400000).toISOString() },
      { title: 'Winnie-the-Pooh', completedAt: new Date(Date.now() - 172800000).toISOString() },
      { title: 'The Cat in the Hat', completedAt: new Date(Date.now() - 259200000).toISOString() },
      { title: 'Green Eggs and Ham', completedAt: new Date(Date.now() - 345600000).toISOString() },
    ],
    vocabularyCount: 45,
  },
  {
    id: 2,
    name: 'Bob',
    age: 11,
    level: 'Intermediate',
    booksRead: 8,
    avgGrammar: 78,
    lastActive: new Date(Date.now() - 7200000).toISOString(),
    email: 'bob.parent@example.com',
    readingHistory: [
      { title: "Charlotte's Web", completedAt: new Date(Date.now() - 7200000).toISOString() },
      { title: 'The Lion, the Witch and the Wardrobe', completedAt: new Date(Date.now() - 86400000).toISOString() },
      { title: 'Magic Tree House: Dinosaurs Before Dark', completedAt: new Date(Date.now() - 172800000).toISOString() },
    ],
    vocabularyCount: 78,
  },
  {
    id: 3,
    name: 'Carol',
    age: 13,
    level: 'Advanced',
    booksRead: 12,
    avgGrammar: 89,
    lastActive: new Date(Date.now() - 10800000).toISOString(),
    email: 'carol.parent@example.com',
    readingHistory: [
      { title: 'A Wrinkle in Time', completedAt: new Date(Date.now() - 10800000).toISOString() },
      { title: 'Inkheart', completedAt: new Date(Date.now() - 86400000).toISOString() },
    ],
    vocabularyCount: 126,
  },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const LEVEL_BADGE_STYLES = {
  Beginner: { bg: '#C8E6C9', text: '#2E7D32' },
  Intermediate: { bg: '#FFE0B2', text: '#E65100' },
  Advanced: { bg: '#E1BEE7', text: '#6A1B9A' },
};

export default function StudentsPage() {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [filteredStudents, setFilteredStudents] = useState(MOCK_STUDENTS);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    level: 'Beginner',
    email: '',
  });

  useEffect(() => {
    let filtered = students;

    if (selectedLevel !== 'All') {
      filtered = filtered.filter((s) => s.level === selectedLevel);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.email.toLowerCase().includes(lower)
      );
    }

    setFilteredStudents(filtered);
  }, [selectedLevel, searchTerm, students]);

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.email) {
      alert('Please fill in all fields');
      return;
    }

    const newStudent = {
      id: Math.max(...students.map((s) => s.id), 0) + 1,
      name: formData.name,
      age: parseInt(formData.age),
      level: formData.level,
      email: formData.email,
      booksRead: 0,
      avgGrammar: 0,
      lastActive: new Date().toISOString(),
      readingHistory: [],
      vocabularyCount: 0,
    };

    setStudents([...students, newStudent]);
    setFormData({ name: '', age: '', level: 'Beginner', email: '' });
    setShowAddForm(false);
  };

  const handleDeleteStudent = (studentId) => {
    setStudents(students.filter((s) => s.id !== studentId));
    setDeleteConfirm(null);
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student.id);
    setFormData({
      name: student.name,
      age: student.age,
      level: student.level,
      email: student.email,
    });
    setShowAddForm(true);
  };

  const handleUpdateStudent = (e) => {
    e.preventDefault();
    setStudents(
      students.map((s) =>
        s.id === editingStudent
          ? {
              ...s,
              name: formData.name,
              age: parseInt(formData.age),
              level: formData.level,
              email: formData.email,
            }
          : s
      )
    );
    setFormData({ name: '', age: '', level: 'Beginner', email: '' });
    setShowAddForm(false);
    setEditingStudent(null);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E]">Student Management</h1>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingStudent(null);
            setFormData({ name: '', age: '', level: 'Beginner', email: '' });
          }}
          className="px-5 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
          style={{ minHeight: '48px' }}
        >
          Add New Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#9B8777] font-semibold"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...LEVELS].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className="px-4 py-2 rounded-xl font-bold transition-all"
              style={{
                minHeight: '48px',
                backgroundColor:
                  selectedLevel === level
                    ? level === 'All'
                      ? '#5C8B5C'
                      : level === 'Beginner'
                      ? '#2E7D32'
                      : level === 'Intermediate'
                      ? '#E65100'
                      : '#6A1B9A'
                    : '#EDE5D4',
                color: selectedLevel === level ? '#FFFFFF' : '#3D2E1E',
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#3D2E1E] bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-md w-full p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </h2>

            <form
              onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Student name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">Age</label>
                  <input
                    type="number"
                    min="6"
                    max="13"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="Age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">Level</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">Parent Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="parent@example.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold"
                  style={{ minHeight: '48px' }}
                >
                  {editingStudent ? 'Update' : 'Add'} Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingStudent(null);
                    setFormData({ name: '', age: '', level: 'Beginner', email: '' });
                  }}
                  className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold"
                  style={{ minHeight: '48px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Name</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Age</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Level</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Books</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Avg Grammar</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Last Active</th>
                <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <React.Fragment key={student.id}>
                  <tr
                    className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedStudent(
                        expandedStudent === student.id ? null : student.id
                      )
                    }
                  >
                    <td className="py-4 px-4 font-bold text-[#3D2E1E]">{student.name}</td>
                    <td className="py-4 px-4 text-[#6B5744] font-semibold">{student.age}</td>
                    <td className="py-4 px-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: LEVEL_BADGE_STYLES[student.level].bg,
                          color: LEVEL_BADGE_STYLES[student.level].text,
                        }}
                      >
                        {student.level}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#6B5744] font-bold">
                      {student.booksRead}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: student.avgGrammar >= 80 ? '#C8E6C9' : '#FFF8E1',
                          color: student.avgGrammar >= 80 ? '#2E7D32' : '#8C6D00',
                        }}
                      >
                        {student.avgGrammar}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#9B8777] text-xs font-semibold">
                      {formatTime(student.lastActive)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStudent(student);
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{
                            backgroundColor: '#E0F4F9',
                            color: '#2A7A8C',
                            minHeight: '36px',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(student.id);
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{
                            backgroundColor: '#FCE8E6',
                            color: '#B85A53',
                            minHeight: '36px',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedStudent === student.id && (
                    <tr className="bg-[#F5F0E8] border-b border-[#E8DEC8]">
                      <td colSpan="7" className="py-4 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Reading History */}
                          <div>
                            <h4 className="font-bold text-[#3D2E1E] mb-3">Reading History</h4>
                            <div className="space-y-2">
                              {student.readingHistory.length > 0 ? (
                                student.readingHistory.map((book, idx) => (
                                  <div key={idx} className="text-sm text-[#6B5744]">
                                    <p className="font-semibold text-[#3D2E1E]">{book.title}</p>
                                    <p className="text-xs text-[#9B8777]">
                                      {formatTime(book.completedAt)}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-[#9B8777]">No books read yet</p>
                              )}
                            </div>
                          </div>

                          {/* Statistics */}
                          <div>
                            <h4 className="font-bold text-[#3D2E1E] mb-3">Vocabulary Stats</h4>
                            <div className="bg-[#FFFCF3] p-4 rounded-xl border border-[#E8DEC8]">
                              <p className="text-sm text-[#6B5744] mb-2">
                                <span className="font-bold text-[#5C8B5C]">
                                  {student.vocabularyCount}
                                </span>{' '}
                                words learned
                              </p>
                              <p className="text-sm text-[#6B5744]">
                                <span className="font-bold text-[#5C8B5C]">
                                  {student.avgGrammar}%
                                </span>{' '}
                                average grammar score
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl float-animation block mb-3">🌿</span>
            <p className="text-[#9B8777] text-lg font-semibold">No students found</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#3D2E1E] bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Delete Student?</h3>
            <p className="text-[#6B5744] mb-6 font-semibold">
              Are you sure you want to delete this student? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteStudent(deleteConfirm)}
                className="flex-1 px-4 py-3 bg-[#D4736B] text-white rounded-xl hover:bg-[#B85A53] transition-all font-bold"
                style={{ minHeight: '48px' }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold"
                style={{ minHeight: '48px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
