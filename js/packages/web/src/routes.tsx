import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { Providers } from './providers';
import { AdminView } from './views/admin';
import { FireballView} from "./views/fireballView";

export function Routes() {
  return (
    <>
      <HashRouter basename={'/'}>
        <Providers>
          <Switch>
            <Route exact path="/admin" component={() => <AdminView />} />
            <Route path="/" component={() => <FireballView />} />
          </Switch>
        </Providers>
      </HashRouter>
    </>
  );
}
