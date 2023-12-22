import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

import React, { useState, useEffect, useContext, useRef} from 'react';
import { Container, Toast} from 'react-bootstrap/';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { PrivateLayout, PublicLayout, PublicToReviewLayout, ReviewLayout, AddPrivateLayout, EditPrivateLayout,  AddPublicLayout, EditPublicLayout, EditReviewLayout, IssueLayout, DefaultLayout, NotFoundLayout, LoginLayout, LoadingLayout, OnlineLayout } from './components/PageLayout';
import { Navigation } from './components/Navigation';

import MessageContext from './messageCtx';
import API from './API';

const url = 'ws://localhost:3002'

function App() {

  const [message, setMessage] = useState('');
  // If an error occurs, the error message will be shown in a toast.
  const handleErrors = (err) => {
    let msg = '';
    if (err.error) msg = err.error;
    else if (typeof(err) === "string") msg = String(err);
    else msg = "Error";
    setMessage(msg); // WARN: a more complex application requires a queue of messages. In this example only last error is shown.
  }

  return (
    <BrowserRouter>
      <MessageContext.Provider value={{ handleErrors }}>
        <Container fluid className="App">
          <Routes>
            <Route path="/*" element={<Main />} />
          </Routes>
          <Toast show={message !== ''} onClose={() => setMessage('')} delay={4000} autohide>
            <Toast.Body>{ message }</Toast.Body>
          </Toast>
        </Container>
      </MessageContext.Provider>
    </BrowserRouter>
  )
}

function Main() {

  // This state is used for displaying a LoadingLayout while we are waiting an answer from the server.
  const [loading, setLoading] = useState(true);
  // This state keeps track if the user is currently logged-in.
  const [loggedIn, setLoggedIn] = useState(false);
  // This state contains the user's info.
  const [user, setUser] = useState(null);
  // This state contains the possible selectable filters.
  const [filters, setFilters] = useState({});
  //This state contains the online list.
  const [onlineList, setOnlineList] = useState([]);
  //This state contains the Film Manager resource.
  const [filmManager, setFilmManager] = useState({});
  const [init, setInit] = useState(false);

  // Error messages are managed at context level (like global variables)
  const {handleErrors} = useContext(MessageContext);

  const location = useLocation();

  let socket = useRef(null);

  useEffect( () => {
    setInit(true);
  }, [])

  //Film manager resource retrieval
  useEffect(() => {

      API.getFilmManager().then(fm => {
        setFilmManager(fm);
        sessionStorage.setItem('filmManager', JSON.stringify(fm));
        console.log(JSON.parse(sessionStorage.getItem('filmManager')))
      })

    },
  []);

  useEffect( () => {
    if(init) {
      const ws = new WebSocket(url);
      ws.onopen = (event) => {};

      ws.onmessage = (event) => {
        let data = JSON.parse(event.data);
        if(data.typeMessage === "login")
          setOnlineList( (onlineList) => [...onlineList, data]);
        if(data.typeMessage === "logout"){
          setOnlineList( (onlineList) => onlineList.filter( (user) => user.userId !== data.userId));
        }
        if(data.typeMessage === "update") {
          setOnlineList( onlineList => onlineList.map( (user) => {
            if(user.userId === data.userId)
              return data;
            return user;
          }));
        }
      };

      ws.onclose = (event) => {
        handleLogout(filmManager).then(r => {});
      };
      setInit(false);
    }
  }, [init]);

  useEffect(() => {
    const init = async () => {
        setLoading(true);

        // Define filters 
        const filters = ['private', 'public', 'public/to_review', 'online'];
        setFilters(filters);

        if(sessionStorage.getItem('user') != undefined){
          setUser(sessionStorage.getItem('user'));
          setLoggedIn(true);
          setLoading(false);
        } else {
          setUser(null);
          setLoggedIn(false);
          setLoading(false);
        } 
    };
    init();
  }, []);  // This useEffect is called only the first time the component is mounted.

  /**
   * This function handles the login process.
   * It requires a email and a password inside a "credentials" object.
   */
  const handleLogin = async (filmManager, credentials) => {
    try {
      const user = await API.logIn(filmManager, credentials);
      sessionStorage.setItem('user', JSON.stringify(user))
      sessionStorage.setItem('userId', user.id);
      sessionStorage.setItem('username', user.name);
      sessionStorage.setItem('email', user.email);
      setUser(user);
      setLoggedIn(true);
    } catch (err) {
      // error is handled and visualized in the login form, do not manage error, throw it
      throw err;
    }
  };

  /**
   * This function handles the logout process.
   */ 
  const handleLogout = async (filmManager) => {
    await API.logOut(filmManager);
    
    setLoggedIn(false);
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('email');
  };

  


  return (
    <>
      <Navigation logout={handleLogout} user={user} loggedIn={loggedIn} filmManager={JSON.parse(sessionStorage.getItem('filmManager'))} />

      <Routes>
        <Route path="/" element={
          loading ? <LoadingLayout />
            : loggedIn ? <DefaultLayout filters={filters} onlineList={onlineList}/>
              : <Navigate to="/login" replace state={location} />
        } >
          <Route index element={<PrivateLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="private" element={<PrivateLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="private/add" element={<AddPrivateLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="private/edit/:filmId" element={<EditPrivateLayout />} />
          <Route path="public" element={<PublicLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="public/add" element={<AddPublicLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="public/edit/:filmId" element={<EditPublicLayout />} />
          <Route path="public/:filmId/reviews" element={<ReviewLayout/>} />
          <Route path="public/:filmId/reviews/complete" element={<EditReviewLayout/>} />
          <Route path="public/:filmId/issue" element={<IssueLayout filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/>} />
          <Route path="public/to_review" element={<PublicToReviewLayout onlineList={onlineList} filmManager={JSON.parse(sessionStorage.getItem('filmManager'))} user={JSON.parse(sessionStorage.getItem('user'))}/>} />
          <Route path="online" element={<OnlineLayout onlineList={onlineList}/>} />
          <Route path="*" element={<NotFoundLayout />} />
        </Route>

        <Route path="/login" element={!loggedIn ? <LoginLayout login={handleLogin} filmManager={JSON.parse(sessionStorage.getItem('filmManager'))}/> : <Navigate replace to='/' />} />
      </Routes>
    </>
  );
}

export default App;
