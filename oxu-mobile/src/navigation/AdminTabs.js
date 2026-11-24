import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { tabScreenOptions } from "./tabOptions";
import withSwipe from "./SwipeScreen";
import AdminScreen from "../screens/AdminScreen";
import AdminWorkspace from "../screens/AdminWorkspace";
import Profile from "../screens/student/StudentProfileScreen";
const Tab = createBottomTabNavigator();
const Home = withSwipe((p) => <AdminWorkspace {...p} />);
const Users = withSwipe((p) => <AdminScreen {...p} section="users" />);
const Catalog = withSwipe((p) => <AdminWorkspace {...p} kind="catalog" />);
const Schedule = withSwipe((p) => <AdminScreen {...p} section="lessons" />);
const Report = withSwipe((p) => <AdminWorkspace {...p} kind="report" />);
const Account = withSwipe(Profile);
export default function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={Home} options={{ title: "Asosiy" }} />
      <Tab.Screen
        name="Users"
        component={Users}
        options={{ title: "Hisoblar" }}
      />
      <Tab.Screen
        name="Catalog"
        component={Catalog}
        options={{ title: "Katalog" }}
      />
      <Tab.Screen
        name="Schedule"
        component={Schedule}
        options={{ title: "Jadval" }}
      />
      <Tab.Screen
        name="Report"
        component={Report}
        options={{ title: "Hisobot" }}
      />
      <Tab.Screen
        name="Profile"
        component={Account}
        options={{ title: "Profil" }}
      />
    </Tab.Navigator>
  );
}
