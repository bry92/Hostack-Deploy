const { Router } = require('express');

module.exports = function(pool) {
  const router = Router();

  router.get('/tasks', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
      res.json({ success: true, tasks: rows });
    } catch (err) {
      console.error('GET /tasks error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  router.post('/tasks', async (req, res) => {
    try {
      const { title, priority, status } = req.body;
      if (!title || !title.toString().trim()) {
        return res.status(400).json({ success: false, message: 'Task is required' });
      }
      const { rows } = await pool.query(
        'INSERT INTO tasks (title, priority, status) VALUES ($1, $2, $3) RETURNING *',
        [title.trim(), (priority || '').trim(), (status || '').trim()]
      );
      res.status(201).json({ success: true, task: rows[0] });
    } catch (err) {
      console.error('POST /tasks error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  router.delete('/tasks/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  return router;
};