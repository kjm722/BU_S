const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const session = require('express-session');
const bodyParser = require("body-parser");
const cors = require('cors');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
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

app.get('/ticket', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

app.get('/timetable', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'timetable.html'));
});

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
app.use(cookieParser());
app.use(session({
  secret: 'Secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}));

//로그인 상태 확인
const checkLoginStatus = (req, res, next) => {
  if (req.session.loggedIn) {
    res.locals.isLoggedIn = true;
    res.locals.username = req.session.username; // 필요하면 사용자명도 전달할 수 있음
  } else {
    res.locals.isLoggedIn = false;
    res.locals.username = null;
  }
  next();
};

app.use(checkLoginStatus);


connection.query('SELECT * FROM bus', (err, rows) => {
  if (err) {
    console.error('오류 발생: ' + err.stack);
    return;
  }
  console.log('결과값:', rows);
});

// 회원가입
app.post('/signup', (req, res) => {
  const { stdno, stddept, stdphone, stdname, stdpw } = req.body;
  const hash = crypto.createHash('sha256').update(stdpw).digest('base64');
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

//로그인
app.post('/login', (req, res) => {
  const { login_stdno, login_stdpw } = req.body;
  const hash = crypto.createHash('sha256').update(login_stdpw).digest('base64');
  const query = 'SELECT * FROM student WHERE stdNo= ? AND stdPw = ?';
  connection.query(query, [login_stdno, hash], (err, rows) => {
    if (err) {
      console.error('MySQL query error: ', err);
      res.status(500).send('로그인 실패');
      return;
    }
    if (rows.length > 0) {
      const user = { stdno: login_stdno, stdname: rows[0].stdname };
      req.session.user = user; // 세션에 사용자 정보 설정
      req.session.loggedIn = true;
      req.session.username = rows[0].stdname;
      console.log('로그인 성공, 세션에 저장된 사용자:', req.session.user); // 로그 추가
      res.cookie('user', req.session.user, { httpOnly: true, });
      res.json({ message: '로그인 성공' });
    } else {
      res.status(401).json({ message: '학번 또는 비밀번호가 일치하지 않습니다' });
    }
  });
});

module.exports = app;

//로그아웃
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

//로그인 세션 유지
app.get('/session-status', (req, res) => {
  if (req.session.user) {
    // 세션이 존재하고 사용자가 로그인되어 있는 경우
    res.json({ isLoggedIn: true, user: req.session.user });
  } else {
    // 세션이 없거나 사용자가 로그아웃된 경우
    res.json({ isLoggedIn: false });
  }
});

//버스 노선 예매 날짜 받아오기
app.get('/get-dates', (req, res) => {
  const query = 'SELECT DISTINCT DATE_FORMAT(tkDate, "%Y-%m-%d") AS value, DATE_FORMAT(tkDate, "%Y-%m-%d") AS text FROM ticketing'
  console.log(query);
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching dates:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results);
  });
});

app.get('/get-times', (req, res) => {
  const route = req.query.busTime;
  if (!route) {
    console.error('Route parameter is missing');
    res.status(400).json({ error: 'Route parameter is missing' });
    return;
  }
  const query = `
  SELECT DISTINCT busTime AS value, busTime AS text 
  FROM bus 
  WHERE CONCAT(busDP, " - ", busAl) = ?
  `;
  connection.query(query,[route],(err, results) => {
    if (err) {
      console.error('Error fetching times:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    console.log('Query results:', results);  // 로그 추가
    res.json(results);
  });
});

app.get('/get-routes', (req, res) => {
  const query = 'SELECT DISTINCT CONCAT(busDP, " - ", busAl) AS value, CONCAT(busDP, " - ", busAl) AS text FROM bus';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching routes:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json(results);
  });
});


app.get('/get-seats', (req, res) => {
  const route = req.query.busTime;
    const time = req.query.busTime;
    const query = `
        SELECT seatNo AS value, seatNo AS text 
        FROM seat
    `;
    connection.query(query, [route, time], (err, results) => {
        if (err) {
            console.error('Error fetching seats:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
        res.json(results);
    });
});

//예매 정보 DB에 저장
app.post('/book-ticket', (req, res) => {
  const stdNo = req.session.user.stdno;
  const { routeId, tkDate, tkTime, seatNo } = req.body;

    // busDp와 busAl에 해당하는 routeId 조회
    const routeQuery = `
        SELECT routeId
        FROM bus
        WHERE CONCAT(busDP, " - ", busAl) = ?
    `;
    connection.query(routeQuery, [routeId], (err, results) => {
        if (err) {
            console.error('Error fetching routeId:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'Route not found' });
            return;
        }

        const routeId = results[0].routeId;

        // ticketing 테이블에 예매 정보 저장
        const insertQuery = `
            INSERT INTO ticketing (routeId, stdNo, tkDate, tkTime, seatNo)
            VALUES (?, ?, ?, ?, ?)
        `;
        connection.query(insertQuery, [routeId, stdNo, tkDate, tkTime, seatNo], (err, results) => {
            if (err) {
                console.error('Error saving reservation:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }
            res.json({ message: 'Reservation saved successfully' });
        });
    });
});


// 예매 내역 조회
app.get('/tickets', (req, res) => {
  if (!req.session.user) {
    console.error('사용자가 로그인되어 있지 않습니다.'); // 로그 추가
    return res.status(401).send('로그인이 필요합니다.');
  }
  const stdNo = req.session.user.stdno;
  //console.log('티켓 조회, 세션에서 가져온 사용자 학번:', stdNo);
  const query = `
  SELECT tKNo, DATE_FORMAT(tkDate, '%Y-%m-%d') AS formattedDate, TIME_FORMAT(tkTime, '%H:%i') AS formattedTime, busDP, busAl, seatNo
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


// 예매 변경
app.post('/modify-reservation', (req, res) => {
  const { tkNo, newDate, newRouteId, newSeatNo } = req.body;

  const query = `
    UPDATE ticketing
    SET tkDate = ?, routeId = ?, seatNo = ?
    WHERE tkNo = ?
  `;

  connection.query(query, [newDate, newRouteId, newSeatNo, tkNo], (err, result) => {
    if (err) {
      console.error('Error modifying reservation:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json({ message: '예매 변경 성공' });
  });
});

// 예매 취소
app.post('/cancel-reservation', (req, res) => {
  const { tkNo } = req.body;

  const query = `DELETE FROM ticketing WHERE tkNo = ?`;

  connection.query(query, [tkNo], (err, result) => {
    if (err) {
      console.error('Error canceling reservation:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json({ message: '예매 취소 성공' });
  });
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});