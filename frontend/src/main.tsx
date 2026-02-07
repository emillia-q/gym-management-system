import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Schedule from "./pages/Schedule";
import Contact from "./pages/Contact";
import SignUp from "./pages/SignUp.tsx";
import MyBookings from "./pages/MyBookings";
import Login from "./pages/Login";
import MyMemberships from "./pages/MyMemberships";
import CancelBooking from "./pages/CancelBooking";



const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "signup", element: <SignUp /> },
      { path: "schedule", element: <Schedule /> },
      { path: "pricing", element: <Pricing /> },
      { path: "contact", element: <Contact /> },
      { path: "my-bookings", element: <MyBookings /> },
      { path: "login", element: <Login /> },
      { path: "my-memberships", element: <MyMemberships /> },
      { path: "cancel-booking", element: <CancelBooking /> },

    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
