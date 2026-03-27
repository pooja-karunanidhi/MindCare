import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role?: 'patient' | 'doctor';
  licenseId?: string;
  specialization?: string;
  bio?: string;
  rating?: number;
  experience?: number;
  isVerified?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);

    // Initial fetch and real-time listener
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      } else {
        // New user, create initial profile without role
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
        };
        setProfile(newProfile);
      }
      setLoading(false);
    }, (error) => {
      // If the error is "permission-denied" and the user is null, it's likely a logout race condition
      if (error.code === 'permission-denied' && !auth.currentUser) {
        console.log('Permission denied on profile fetch during logout (expected).');
      } else {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        alert('The sign-in popup was blocked by your browser. Please allow popups for this site or open the app in a new tab.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log('Sign-in popup was closed before completion.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('Sign-in popup was closed by the user.');
      } else {
        console.error('Sign in error:', error);
        alert(`Sign in failed: ${error.message}`);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      // Merge current profile info with new data to ensure required fields (uid, email, role)
      // are always present for the security rules validation.
      const fullData = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        ...profile,
        ...data
      };

      // Filter out undefined values as Firestore doesn't support them
      const cleanData = Object.fromEntries(
        Object.entries(fullData).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(userDocRef, cleanData, { merge: true });
      
      // Update local profile state
      setProfile(cleanData as unknown as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
