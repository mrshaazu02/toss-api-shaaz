const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/api/toss-results', async (req, res) => {
  try {
    const { hallTicket } = req.body;
    if (!hallTicket) return res.status(400).json({ error: 'Hall Ticket Number is required' });

    const response = await axios.post(
      'https://www.telanganaopenschool.org/toss2025_results.php',
      new URLSearchParams({ htno: hallTicket }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.telanganaopenschool.org',
          'Referer': 'https://www.telanganaopenschool.org/toss_results.html'
        }
      }
    );

    const $ = cheerio.load(response.data);
    if (response.data.includes('Invalid Hall Ticket')) {
      return res.status(404).json({ error: 'Invalid Hall Ticket Number' });
    }

    const studentName = $('table tr:eq(1) td:eq(1)').text().trim();
    const fatherName = $('table tr:eq(2) td:eq(1)').text().trim();
    const hallTicketNo = $('table tr:eq(3) td:eq(1)').text().trim();
    const dob = $('table tr:eq(4) td:eq(1)').text().trim();

    const subjects = [];
    let totalMarks = 0;
    let maxMarks = 0;

    $('table tr').each((i, row) => {
      if (i >= 7) {
        const cols = $(row).find('td');
        if (cols.length >= 4) {
          const subjectName = $(cols[0]).text().trim();
          const theoryMarks = parseInt($(cols[1]).text().trim()) || 0;
          const practicalMarks = parseInt($(cols[2]).text().trim()) || 0;
          const totalSubjectMarks = theoryMarks + practicalMarks;
          const maxSubjectMarks = subjectName.includes('Practical') ? 50 : 100;
          const result = totalSubjectMarks >= (maxSubjectMarks * 0.35) ? 'Pass' : 'Fail';

          if (subjectName) {
            subjects.push({
              name: subjectName,
              theoryMarks,
              practicalMarks,
              totalMarks: totalSubjectMarks,
              maxMarks: maxSubjectMarks,
              result
            });
            totalMarks += totalSubjectMarks;
            maxMarks += maxSubjectMarks;
          }
        }
      }
    });

    const percentage = (totalMarks / maxMarks) * 100;
    const finalResult = subjects.every(sub => sub.result === 'Pass') ? 'Pass' : 'Fail';
    let division = '';
    const remarks = finalResult === 'Pass' ? 'Qualified' : 'Needs Improvement';

    if (finalResult === 'Pass') {
      if (percentage >= 60) division = 'First Division';
      else if (percentage >= 45) division = 'Second Division';
      else division = 'Third Division';
    }

    res.json({
      studentName,
      fatherName,
      hallTicket: hallTicketNo,
      dob,
      subjects,
      totalMarks,
      maxMarks,
      percentage: percentage.toFixed(2),
      finalResult,
      division,
      remarks,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
