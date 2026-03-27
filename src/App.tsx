/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { 
  LogIn, LogOut, User, Calendar, MessageSquare, ShieldCheck, HeartPulse, 
  Stethoscope, Clock, CheckCircle, XCircle, Send, Star, ClipboardList, Save 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, Timestamp } from './firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, orderBy, getDocs, getDoc, setDoc } from 'firebase/firestore';

// --- Components ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong.";
      if (error && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          errorMessage = `Firestore Error: ${parsed.operationType} at ${parsed.path} failed.`;
        } catch (e) {
          errorMessage = error.message;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6 mx-auto">
              <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">Application Error</h2>
            <p className="text-slate-600 text-sm text-center mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
    />
  </div>
);

const Navbar = () => {
  const { user, profile, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <HeartPulse className="text-indigo-600 w-8 h-8" />
        <span className="text-xl font-bold text-slate-900">MindCare</span>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="flex items-center gap-2 text-slate-600">
              <img src={profile?.photoURL} alt="" className="w-8 h-8 rounded-full border" />
              <span className="text-sm font-medium hidden sm:inline">{profile?.displayName}</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase font-bold">
                {profile?.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

const RoleSelection = () => {
  const { updateProfile } = useAuth();
  const [licenseId, setLicenseId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor' | null>(null);

  const handleSubmit = async () => {
    if (!role) return;
    if (role === 'doctor' && (!licenseId || !specialization)) return;

    await updateProfile({
      role,
      licenseId: role === 'doctor' ? licenseId : undefined,
      specialization: role === 'doctor' ? specialization : undefined,
      bio: role === 'doctor' ? bio : undefined,
      rating: role === 'doctor' ? 4.5 : undefined, // Default rating
      experience: role === 'doctor' ? 5 : undefined, // Default experience
      isVerified: role === 'doctor' ? true : undefined,
    });
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Welcome to MindCare</h2>
        <p className="text-slate-500 text-center mb-8">Please select your role to continue</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setRole('patient')}
            className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
              role === 'patient' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-600'
            }`}
          >
            <User className="w-10 h-10" />
            <span className="font-bold">Patient</span>
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
              role === 'doctor' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-600'
            }`}
          >
            <Stethoscope className="w-10 h-10" />
            <span className="font-bold">Doctor</span>
          </button>
        </div>

        <AnimatePresence>
          {role === 'doctor' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Unique License ID</label>
                <input
                  type="text"
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  placeholder="Enter your medical license ID"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Clinical Psychologist"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Short Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell patients about yourself..."
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleSubmit}
          disabled={!role || (role === 'doctor' && (!licenseId || !specialization))}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
};

const FeedbackDisplay = ({ feedback }: { feedback: any }) => {
  if (!feedback) return null;
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className={`w-4 h-4 ${feedback.rating >= star ? 'fill-current' : 'text-slate-200'}`} />
          ))}
        </div>
        <span className="text-xs font-bold text-amber-700 uppercase">Patient Feedback</span>
      </div>
      {feedback.comment && (
        <p className="text-sm text-slate-600 italic">"{feedback.comment}"</p>
      )}
    </div>
  );
};

const Chat = ({ sessionId, onClose }: { sessionId: string; onClose: () => void }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [session, setSession] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [confirmFinish, setConfirmFinish] = useState(false);

  useEffect(() => {
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSession({ id: doc.id, ...data });
        // If session just became completed, show appropriate modal
        if (data.status === 'completed') {
          if (profile?.role === 'patient' && !data.feedback) {
            setShowFeedback(true);
          }
          // Always show remedies to both if they just finished
          setShowNotes(true);
        }
      }
    });

    const q = query(
      collection(db, 'sessions', sessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}/messages`);
    });

    return () => {
      unsubSession();
      unsubscribeMessages();
    };
  }, [sessionId, profile?.role]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || session?.status === 'completed') return;

    try {
      await addDoc(collection(db, 'sessions', sessionId, 'messages'), {
        senderId: profile.uid,
        text: newMessage,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}/messages`);
    }
  };

  const [finishError, setFinishError] = useState<string | null>(null);

  const finishSession = async () => {
    setFinishError(null);
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'completed'
      });
      setConfirmFinish(false);
    } catch (error) {
      setFinishError("Failed to finish session. Please try again.");
      console.error(error);
    }
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            <h3 className="font-bold">Session Chat</h3>
            {session.status === 'completed' && (
              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Completed</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session.status === 'accepted' && (
              <div className="flex items-center gap-2">
                {confirmFinish ? (
                  <div className="flex items-center gap-1 bg-red-700 p-1 rounded-lg">
                    <span className="text-[10px] font-bold text-white px-1">End?</span>
                    <button 
                      onClick={finishSession}
                      className="bg-white text-red-600 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-slate-100 transition-colors"
                    >
                      Yes
                    </button>
                    <button 
                      onClick={() => setConfirmFinish(false)}
                      className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-500 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmFinish(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle className="w-3 h-3" /> Finish Session
                  </button>
                )}
              </div>
            )}
            {finishError && (
              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold">{finishError}</span>
            )}
            {session.status === 'completed' && (
              <button 
                onClick={() => setShowNotes(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ClipboardList className="w-3 h-3" /> {profile?.role === 'doctor' ? 'Remedies' : 'View Remedies'}
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === profile?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.senderId === profile?.uid
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {session.status === 'completed' && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400 font-medium bg-slate-100 py-2 px-4 rounded-full inline-block">
                This session has ended.
              </p>
            </div>
          )}
        </div>

        {session.status !== 'completed' && (
          <form onSubmit={sendMessage} className="p-4 border-t bg-white flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-full border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              type="submit"
              className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </motion.div>

      {showFeedback && (
        <FeedbackModal 
          sessionId={sessionId} 
          onClose={() => setShowFeedback(false)} 
        />
      )}

      {showNotes && (
        <RemediesModal 
          sessionId={sessionId} 
          onClose={() => setShowNotes(false)} 
          readOnly={profile?.role === 'patient'}
        />
      )}
    </div>
  );
};

const FeedbackModal = ({ sessionId, onClose }: { sessionId: string; onClose: () => void }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async () => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        feedback: {
          rating,
          comment,
          createdAt: serverTimestamp()
        }
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-2">Session Feedback</h3>
        <p className="text-sm text-slate-500 mb-6">How was your experience with the doctor today?</p>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`p-2 transition-all ${rating >= star ? 'text-amber-400 scale-110' : 'text-slate-200'}`}
            >
              <Star className="w-8 h-8 fill-current" />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: Share more about your experience..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none mb-6 text-sm"
        />

        <button
          onClick={submitFeedback}
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </motion.div>
    </div>
  );
};

const RemediesModal = ({ sessionId, onClose, readOnly = false }: { sessionId: string; onClose: () => void; readOnly?: boolean }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const noteDoc = await getDoc(doc(db, 'sessions', sessionId, 'notes', 'doctor'));
        if (noteDoc.exists()) {
          setNote(noteDoc.data().text);
        }
      } catch (error) {
        console.error('Error fetching note:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [sessionId]);

  const saveNote = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'sessions', sessionId, 'notes', 'doctor'), {
        text: note,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}/notes/doctor`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-indigo-600" /> {readOnly ? "Doctor's Recommendations" : "Remedies & Recommendations"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
          <Star className="w-3 h-3 inline mr-1 text-indigo-600" />
          {readOnly 
            ? "These are the remedies and steps recommended by your doctor for your progress." 
            : "Provide remedies, exercises, or lifestyle changes for the patient. These will be visible to them."}
        </p>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <>
            {readOnly ? (
              <div className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 h-64 overflow-y-auto mb-6 text-sm font-medium text-slate-700 whitespace-pre-wrap">
                {note || "No specific remedies provided yet."}
              </div>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write remedies and recommendations here..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-64 resize-none mb-6 text-sm font-mono"
              />
            )}

            {!readOnly && (
              <button
                onClick={saveNote}
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save & Share with Patient'}
              </button>
            )}
            
            {readOnly && (
              <button
                onClick={onClose}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Close
              </button>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

const BookingModal = ({ doctor, onClose, onConfirm }: { doctor: any; onClose: () => void; onConfirm: (metrics: any) => void }) => {
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(5);
  const [concern, setConcern] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('low');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">Session Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Booking with <span className="font-bold text-indigo-600">{doctor.displayName}</span>. 
          Please share how you're feeling to help the doctor prepare.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
              Current Mood <span>{mood}/10</span>
            </label>
            <input
              type="range" min="1" max="10" value={mood}
              onChange={(e) => setMood(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
              Stress Level <span>{stress}/10</span>
            </label>
            <input
              type="range" min="1" max="10" value={stress}
              onChange={(e) => setStress(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Primary Concern</label>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="Briefly describe what's on your mind..."
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Urgency</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`py-2 rounded-lg text-xs font-bold uppercase border-2 transition-all ${
                    urgency === u ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onConfirm({ mood, stress, concern, urgency })}
          disabled={!concern.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-8 hover:bg-indigo-700 disabled:opacity-50 transition-all"
        >
          Send Request
        </button>
      </motion.div>
    </div>
  );
};

const PatientDashboard = () => {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);

  useEffect(() => {
    // Fetch verified doctors in real-time
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'doctor'), 
      where('isVerified', '==', true)
    );
    
    const unsubscribeDoctors = onSnapshot(q, (snapshot) => {
      let realDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Dummy doctors for demo purposes
      const dummyDocs = [
        {
          id: 'dummy1',
          displayName: 'Dr. Sarah Jenkins',
          photoURL: 'https://picsum.photos/seed/doctor1/200',
          specialization: 'Clinical Psychologist',
          bio: 'Specializing in anxiety and cognitive behavioral therapy with 10+ years of experience.',
          rating: 4.9,
          experience: 12,
          isDummy: true
        },
        {
          id: 'dummy2',
          displayName: 'Dr. Michael Chen',
          photoURL: 'https://picsum.photos/seed/doctor2/200',
          specialization: 'Psychiatrist',
          bio: 'Expert in mood disorders and medication management. Dedicated to holistic patient care.',
          rating: 4.7,
          experience: 8,
          isDummy: true
        }
      ];

      // Combine real and dummy doctors, but prioritize real ones
      // If we have real doctors, we can still show dummy ones to fill the space if needed
      setDoctors([...realDocs, ...dummyDocs]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    // Fetch user sessions
    let unsubscribeSessions = () => {};
    if (profile?.uid) {
      const sq = query(collection(db, 'sessions'), where('patientId', '==', profile.uid));
      unsubscribeSessions = onSnapshot(sq, (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessions');
      });
    }

    return () => {
      unsubscribeDoctors();
      unsubscribeSessions();
    };
  }, [profile]);

  const [bookingSuccess, setBookingSuccess] = useState(false);

  const bookSession = async (metrics: any) => {
    if (!profile || !bookingDoctor) return;
    try {
      await addDoc(collection(db, 'sessions'), {
        patientId: profile.uid,
        doctorId: bookingDoctor.id,
        status: 'pending',
        metrics,
        scheduledAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setBookingDoctor(null);
      setBookingSuccess(true);
      setTimeout(() => setBookingSuccess(false), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="text-indigo-600" /> Available Doctors
          </h2>
          <AnimatePresence>
            {bookingSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <CheckCircle className="w-4 h-4" /> Request Sent Successfully!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <motion.div
              key={doc.id}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <img src={doc.photoURL} alt="" className="w-14 h-14 rounded-full border-2 border-indigo-100 object-cover" />
                  <div>
                    <h3 className="font-bold text-slate-900">{doc.displayName}</h3>
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">{doc.specialization || 'Professional'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <ShieldCheck className="w-4 h-4" /> {doc.rating || 4.5}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-4 h-4" /> {doc.experience || 5}+ yrs
                  </div>
                </div>

                <p className="text-sm text-slate-600 line-clamp-3 mb-4 italic">
                  "{doc.bio || 'Dedicated to providing quality mental health support.'}"
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                {doc.isDummy ? (
                  <p className="text-[10px] text-slate-400 text-center mb-2 font-medium">Demo Profile Only</p>
                ) : null}
                <button
                  onClick={() => {
                    if (!doc.isDummy) {
                      setBookingDoctor(doc);
                    }
                  }}
                  disabled={doc.isDummy}
                  className={`w-full py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                    doc.isDummy 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                  }`}
                >
                  <Calendar className="w-4 h-4" /> Book Session
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Calendar className="text-indigo-600" /> Your Sessions
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">Doctor</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">Dr. {doctors.find(d => d.id === session.doctorId)?.displayName || 'Professional'}</span>
                      </div>
                      {session.status === 'accepted' && session.scheduledAt && (
                        <p className="text-[10px] text-indigo-600 font-bold ml-11">
                          Scheduled: {session.scheduledAt.toDate().toLocaleString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase w-fit ${
                        session.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        session.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        session.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {session.status}
                      </span>
                      {session.feedback && (
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`w-3 h-3 ${session.feedback.rating >= star ? 'fill-current' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      {(session.status === 'accepted' || session.status === 'completed') && (
                        <button
                          onClick={() => setActiveChat(session.id)}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm"
                        >
                          <MessageSquare className="w-4 h-4" /> {session.status === 'completed' ? 'History' : 'Chat Now'}
                        </button>
                      )}
                      {session.status === 'accepted' && (
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'sessions', session.id), { status: 'completed' });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.WRITE, `sessions/${session.id}`);
                            }
                          }}
                          className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold text-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> Finish Session
                        </button>
                      )}
                      {session.status === 'completed' && (
                        <button
                          onClick={() => {
                            setActiveChat(session.id);
                          }}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm"
                        >
                          <ClipboardList className="w-4 h-4" /> View Remedies
                        </button>
                      )}
                      {session.status === 'completed' && !session.feedback && (
                        <button
                          onClick={() => setActiveChat(session.id)}
                          className="flex items-center gap-2 text-amber-600 hover:text-amber-700 font-bold text-sm"
                        >
                          <Star className="w-4 h-4" /> Give Feedback
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No sessions booked yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeChat && <Chat sessionId={activeChat} onClose={() => setActiveChat(null)} />}
      {bookingDoctor && <BookingModal doctor={bookingDoctor} onClose={() => setBookingDoctor(null)} onConfirm={bookSession} />}
    </div>
  );
};

const DoctorDashboard = () => {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [schedulingSession, setSchedulingSession] = useState<any | null>(null);

  useEffect(() => {
    if (profile?.uid) {
      const q = query(collection(db, 'sessions'), where('doctorId', '==', profile.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessions');
      });
      return () => unsubscribe();
    }
  }, [profile]);

  const updateStatus = async (sessionId: string, status: 'accepted' | 'rejected', scheduledTime?: Date) => {
    try {
      const updateData: any = { status };
      if (scheduledTime) {
        updateData.scheduledAt = Timestamp.fromDate(scheduledTime);
      }
      await updateDoc(doc(db, 'sessions', sessionId), updateData);
      setSchedulingSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-indigo-600 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-200">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Doctor Dashboard</h2>
            <p className="text-indigo-100">Welcome back, {profile?.displayName}. Your license is verified.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
            <p className="text-xs uppercase font-bold text-indigo-200">Total Sessions</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
            <p className="text-xs uppercase font-bold text-indigo-200">Pending</p>
            <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'pending').length}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="text-indigo-600" /> Active Requests
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.filter(s => s.status !== 'completed').map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Patient Request</h3>
                    <p className="text-xs text-slate-500">ID: {session.patientId.slice(0, 8)}...</p>
                    {session.status === 'accepted' && session.scheduledAt && (
                      <p className="text-[10px] text-indigo-600 font-bold mt-1">
                        Scheduled: {session.scheduledAt.toDate().toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                  session.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  session.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {session.status}
                </span>
              </div>

              {session.metrics && (
                <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Mood</p>
                      <p className="text-sm font-bold text-indigo-600">{session.metrics.mood}/10</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Stress</p>
                      <p className="text-sm font-bold text-indigo-600">{session.metrics.stress}/10</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Urgency</p>
                    <p className={`text-xs font-bold uppercase ${
                      session.metrics.urgency === 'high' ? 'text-red-600' :
                      session.metrics.urgency === 'medium' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>{session.metrics.urgency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Concern</p>
                    <p className="text-sm text-slate-600 italic">"{session.metrics.concern}"</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {session.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => setSchedulingSession(session)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => updateStatus(session.id, 'rejected')}
                      className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </>
                ) : session.status === 'accepted' ? (
                  <div className="flex flex-col w-full gap-2">
                    <button
                      onClick={() => setActiveChat(session.id)}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" /> Open Chat
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'sessions', session.id), { status: 'completed' });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, `sessions/${session.id}`);
                        }
                      }}
                      className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                    >
                      <CheckCircle className="w-4 h-4" /> Finish Session
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-2 text-center text-slate-400 text-sm italic border border-dashed rounded-lg">
                    Session {session.status}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {sessions.filter(s => s.status !== 'completed').length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 font-medium">No active appointment requests.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <CheckCircle className="text-green-600" /> Completed Sessions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.filter(s => s.status === 'completed').map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Completed Session</h3>
                    <p className="text-xs text-slate-500">ID: {session.patientId.slice(0, 8)}...</p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-1 rounded-full uppercase bg-green-100 text-green-700">
                  Completed
                </span>
              </div>

              <FeedbackDisplay feedback={session.feedback} />

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setActiveChat(session.id)}
                  className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> History
                </button>
                <button
                  onClick={() => {
                    setActiveChat(session.id);
                  }}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ClipboardList className="w-4 h-4" /> {profile?.role === 'doctor' ? 'Remedies' : 'Remedies'}
                </button>
              </div>
            </motion.div>
          ))}
          {sessions.filter(s => s.status === 'completed').length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 font-medium">No completed sessions yet.</p>
            </div>
          )}
        </div>
      </section>

      {activeChat && <Chat sessionId={activeChat} onClose={() => setActiveChat(null)} />}
      {schedulingSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="text-indigo-600" /> Schedule Session
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Please select a date and time for this consultation.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const date = formData.get('date') as string;
              const time = formData.get('time') as string;
              if (date && time) {
                updateStatus(schedulingSession.id, 'accepted', new Date(`${date}T${time}`));
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
                <input 
                  type="date" 
                  name="date" 
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Time</label>
                <input 
                  type="time" 
                  name="time" 
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSchedulingSession(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  Confirm & Accept
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const Landing = () => {
  const { signIn, signingIn } = useAuth();

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl"
      >
        <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200">
          <HeartPulse className="text-white w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">
          Mental Wellness, <span className="text-indigo-600">Simplified.</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          Connect with professional counselors and manage your mental health journey in a secure, private environment.
        </p>
        <button
          onClick={signIn}
          disabled={signingIn}
          className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-3 mx-auto disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {signingIn ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (
            <LogIn className="w-6 h-6" />
          )}
          {signingIn ? 'Signing in...' : 'Get Started with Google'}
        </button>
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <ShieldCheck className="text-indigo-600 mb-4" />
            <h3 className="font-bold mb-2">Secure & Private</h3>
            <p className="text-sm text-slate-500">End-to-end encrypted chats for your peace of mind.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <Stethoscope className="text-indigo-600 mb-4" />
            <h3 className="font-bold mb-2">Verified Doctors</h3>
            <p className="text-sm text-slate-500">All professionals are verified with their medical licenses.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <MessageSquare className="text-indigo-600 mb-4" />
            <h3 className="font-bold mb-2">Instant Support</h3>
            <p className="text-sm text-slate-500">Book sessions and start chatting immediately.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Landing />
    </div>
  );

  if (!profile?.role) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <RoleSelection />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main>
        {profile.role === 'patient' ? <PatientDashboard /> : <DoctorDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

