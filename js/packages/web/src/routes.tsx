import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';

import { createTheme, ThemeProvider } from "@mui/material";
import { purple } from "@mui/material/colors";

import { Providers } from './providers';
import { AdminView } from './views/admin';
import { FireballView} from "./views/fireballView";

export function Routes() {
  const { palette } = createTheme();
  const theme = createTheme({
    palette: {
      white: palette.augmentColor({
        color: {
          main: "#ffffff"
        }
      })
    }
  });

  return (
    <>
      <HashRouter basename={'/'}>
        <Providers>
          <ThemeProvider theme={theme}>
            <Switch>
              <Route exact path="/admin" component={() => <AdminView />} />
              <Route path="/" component={() => <FireballView />} />
            </Switch>
          </ThemeProvider>
        </Providers>
      </HashRouter>
    </>
  );
}
