const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const session = require('express-session');
const bodyParser = require("body-parser");
const cors = require('cors');
const crypto = require('crypto');
const port = 3000;


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});


app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/modify', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('로그인이 필요합니다.');
  }
  res.sendFile(path.join(__dirname, 'public', 'modify.html'));
});

app.get('/modify_action', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'modify_action.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

/*app.get('/', (req, res) => {
  res.sendFile(__dirname + '/test.html');
});*/

// MySQL과 연결하는 객체 생성
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'user',
  password: '1739',
  database: 'bus_db'
});

connection.connect();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'Secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));


connection.query('SELECT * FROM bus', (err, rows) => {
  if (err) {
    console.error('오류 발생: ' + err.stack);
    return;
  }
  console.log('결과값:', rows);
});

// 회원가입
app.post('/signup', (req, res) => {
  const {stdno, stddept, stdphone, stdname, stdpw} = req.body;
  const hash = crypto.createHash('sha256').update(stdpw).digest('hex');
  const query = `INSERT INTO student (stdNo, stdDept, stdPhone, stdName, stdPw) VALUES (?,?,?,?,?)`;
  connection.query(query, [stdno, stddept, stdphone, stdname, hash], (err, result) => {
    if (err) {
      console.error('MySQL query error: ', err);
      res.status(500).send('회원가입 실패');
      return;
    }
    console.log('회원가입 성공');
    res.redirect('/login')
  });
});

app.post('/login', (req, res) => {
  const { stdno, stdpw } = req.body;
  const hash = crypto.createHash('sha256').update(stdpw).digest('hex');
  const query = 'SELECT * FROM student WHERE stdNo= ? AND stdPw = ?';
  console.log(hash);
  console.log(query);
  connection.query(query, [stdno, hash], (err, rows) => {
    if (err) {
      console.error('MySQL query error: ', err);
      res.status(500).send('로그인 실패');
      return;
    }
    if (rows.length > 0) {
      req.session.user = { stdno: stdno };
      res.json({ message: '로그인 성공' });
      res.redirect('/')
    } else {
      res.status(401).json({ message: '학번 또는 비밀번호가 일치하지 않습니다' });
    }
  });
});

// 세션에 사용자가 로그인되어 있는지 확인하는 미들웨어
app.post('/logout', (req, res) => {
  // 세션 삭제
  req.session.destroy(err => {
    if (err) {
      console.error('세션 삭제 중 오류 발생:', err);
      res.status(500).json({ message: '서버 오류' });
      return;
    }
    res.json({ message: '로그아웃 성공' });
  });
});

// 로그인 상태 확인
app.get('/check-login-status', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// 모든 busDP 값 가져오기
app.get('/bus-dp', (req, res) => {
  const query = 'SELECT DISTINCT busDP FROM bus WHERE busDP <> "학교" ORDER BY busDP ASC';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }

    const busDPs = results.map(row => row.busDP);
    res.json(busDPs);
  });
});

// 특정 busDP에 해당하는 busTime 값 가져오기
app.get('/bus-dp-times', (req, res) => {
  const busDP = req.query.busDP;
  const query = 'SELECT busTime FROM bus WHERE busDP = ? ORDER BY busTime ASC';
  connection.query(query, [busDP], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }

    const busdpTimes = results.map(row => row.busTime);
    res.json(busdpTimes);
  });
});

//모든 busAl 값 가져오기
app.get('/bus-al', (req, res) => {
  const query = 'SELECT DISTINCT busAl FROM bus WHERE busAl <> "학교" ORDER BY busAl ASC ';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }

    const busAls = results.map(row => row.busAl);
    res.json(busAls);
  });
});

// 특정 busAl에 해당하는 busTime 값 가져오기
app.get('/bus-al-times', (req, res) => {
  const busAl = req.query.busAl;
  const query = 'SELECT busTime FROM bus WHERE busAl = ? ORDER BY busTime ASC';
  connection.query(query, [busAl], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }

    const busalTimes = results.map(row => row.busTime);
    res.json(busalTimes);
  });
});

// 예매 내역 조회
app.get('/tickets/:stdNo', (req, res) => {
  if (!req.session.user || req.session.user.stdno !== req.params.stdNo) {
    return res.status(401).send('로그인이 필요합니다.');
  }
  const stdNo = req.params.stdNo;
  const query = `
    SELECT tKNo, tkDate, busTime, busDP, busAl
    FROM ticketing
    JOIN bus ON ticketing.routeId = bus.routeId
    WHERE stdNo = ?
  `;
  connection.query(query, [stdNo], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});