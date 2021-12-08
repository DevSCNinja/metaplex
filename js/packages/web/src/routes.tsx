import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { Providers } from './providers';
import { AdminView } from './views/admin';
import { FireballView} from "./views/fireballView";

export function Routes() {
  return (
    <>
      <BrowserRouter basename={'/'}>
        <Providers>
          <Switch>
            <Route path="/cities" component={() => <FireballView />} />
          </Switch>
        </Providers>
      </BrowserRouter>
    </>
  );
}
