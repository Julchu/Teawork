'use client';
import {
  createContext,
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { UserInfo } from 'src/lib/firebase/interfaces';
import useUserHook from 'src/hooks/use-user-firestore-hook';
import { authentication } from 'src/lib/firebase/client-app';
import { useRouter } from 'next/navigation';
import { firebaseConfig } from 'src/lib/firebase/firebase-config';

export const AuthContext = createContext<AuthProps>({
  userInfo: {},
  setUserInfo: () => void 0,
  userLoading: false,
  setUserLoading: () => void 0,
  login: () => void 0,
  logout: () => void 0,
});

type AuthProps = {
  authUser?: User | null;
  authLoading?: boolean;
  login: () => void;
  logout: () => void;

  userInfo: Partial<UserInfo | undefined>;
  setUserInfo: Dispatch<SetStateAction<Partial<UserInfo | undefined>>>;
  userLoading: boolean;
  setUserLoading: Dispatch<SetStateAction<boolean>>;
};

export const useAuthContext = (): AuthProps => useContext(AuthContext);

const AuthProvider: FC<{ children: ReactNode; currentUser?: User }> = ({
  children,
  currentUser,
}) => {
  const [authUser, setAuthUser] = useState<User | undefined>(currentUser);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<Partial<UserInfo>>();
  const [userLoading, setUserLoading] = useState<boolean>(false);
  const [{ getUser }] = useUserHook();

  const router = useRouter();

  const login = useCallback(async () => {
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    await signInWithPopup(authentication, provider); // signInWithRedirect(auth, provider) doesn't work for mobile for now
  }, []);

  const logout = useCallback(() => {
    authentication
      .signOut()
      .then(async () => {
        // Sign-out successful.
        setAuthUser(undefined);
        // await deleteCookies(['__session']);
        router.refresh();
        console.log('Signed out');
      })
      .catch(error => {
        // An error happened.
        console.log('Sign out error:', error);
      });
    setAuthLoading(false);
  }, [router]);

  const handleAuthChange = useCallback(
    async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        const retrievedUser = await getUser(firebaseUser);
        // await setCookies([{ key: '__session', value: await firebaseUser.getIdToken() }]);

        if (retrievedUser) {
          setUserInfo({ ...retrievedUser?.data() });
        }
      } else {
        setAuthUser(undefined);
        setUserInfo({});
        // await deleteCookies(['__session']);
        console.log('User is not logged');
      }
      router.refresh();
      setAuthLoading(false);
    },
    [getUser, router],
  );

  useEffect(() => {
    // Install service worker if supported.
    if ('serviceWorker' in navigator) {
      if (caches) {
        // Service worker cache should be cleared with caches.delete()
        caches.keys().then(async names => {
          await Promise.all(names.map(name => caches.delete(name)));
        });
      }
      const serializedFirebaseConfig = encodeURIComponent(JSON.stringify(firebaseConfig));
      // if (process.env.NEXT_PUBLIC_LAN !== undefined): serviceWorkerUrl =  `/auth-service-worker.js?firebaseConfig=${serializedFirebaseConfig}&lan=${process.env.NEXT_PUBLIC_LAN}`;
      const serviceWorkerUrl = `/auth-service-worker.js?firebaseConfig=${serializedFirebaseConfig}`;

      navigator.serviceWorker
        .register(serviceWorkerUrl, { scope: '/' })
        .then(reg => {
          // Registration worked.
          console.log('Registration succeeded. Scope is ' + reg.scope);
        })
        .catch(error => {
          // Registration failed.
          console.log('Registration failed with ' + error.message);
        });
      router.refresh();
    }
  }, [router]);

  // Auth persistence: detect if user is authenticated or not (on page change, on page refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authentication, handleAuthChange);
    return () => unsubscribe();
  }, [handleAuthChange]);

  useEffect(() => {
    onAuthStateChanged(authentication, async firebaseUser => {
      if (authUser === undefined) return;

      if (authUser?.email !== firebaseUser?.email) {
        // await deleteCookies(['token']);
        router.refresh();
      }
    });
  }, [authUser, router]);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        authLoading,
        userInfo,
        setUserInfo,
        userLoading,
        setUserLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;