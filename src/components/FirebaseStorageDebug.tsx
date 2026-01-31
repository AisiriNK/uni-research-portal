/**
 * Firebase Storage Debug Component
 * 
 * Add this component to your StudentDashboard to diagnose storage issues
 */

import React, { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/config/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
}

export function FirebaseStorageDebug() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    // Test 1: Check Storage Configuration
    try {
      const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
      if (!storageBucket) {
        addResult({
          name: 'Storage Bucket Config',
          status: 'error',
          message: 'VITE_FIREBASE_STORAGE_BUCKET not found in .env file'
        });
      } else {
        addResult({
          name: 'Storage Bucket Config',
          status: 'success',
          message: `Bucket: ${storageBucket}`
        });
      }
    } catch (error) {
      addResult({
        name: 'Storage Bucket Config',
        status: 'error',
        message: 'Failed to read environment variables'
      });
    }

    // Test 2: Check Authentication
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        addResult({
          name: 'Authentication',
          status: 'error',
          message: 'No user logged in'
        });
      } else {
        addResult({
          name: 'Authentication',
          status: 'success',
          message: `Logged in as: ${currentUser.uid}`
        });
      }
    } catch (error) {
      addResult({
        name: 'Authentication',
        status: 'error',
        message: 'Authentication check failed'
      });
    }

    // Test 3: Check Storage Instance
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      if (!storage) {
        addResult({
          name: 'Storage Instance',
          status: 'error',
          message: 'Storage instance not initialized'
        });
      } else {
        addResult({
          name: 'Storage Instance',
          status: 'success',
          message: 'Storage instance initialized correctly'
        });
      }
    } catch (error) {
      addResult({
        name: 'Storage Instance',
        status: 'error',
        message: 'Storage instance error'
      });
    }

    // Test 4: Try to create a reference
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const testRef = ref(storage, 'test/diagnostic-test.txt');
      addResult({
        name: 'Storage Reference',
        status: 'success',
        message: `Reference created: ${testRef.fullPath}`
      });
    } catch (error: any) {
      addResult({
        name: 'Storage Reference',
        status: 'error',
        message: error.message || 'Failed to create storage reference'
      });
    }

    // Test 5: Try to upload a test file
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        addResult({
          name: 'Test Upload',
          status: 'warning',
          message: 'Skipped - no user logged in'
        });
      } else {
        const testBlob = new Blob(['Test upload from diagnostic tool'], { type: 'text/plain' });
        const testRef = ref(storage, `no-due-submissions/${currentUser.uid}/diagnostic-test-${Date.now()}.txt`);
        
        await uploadBytes(testRef, testBlob);
        
        addResult({
          name: 'Test Upload',
          status: 'success',
          message: 'Successfully uploaded test file'
        });

        // Test 6: Try to get download URL
        try {
          const url = await getDownloadURL(testRef);
          addResult({
            name: 'Download URL',
            status: 'success',
            message: 'Successfully retrieved download URL'
          });
        } catch (error: any) {
          addResult({
            name: 'Download URL',
            status: 'warning',
            message: error.message || 'Could not retrieve download URL'
          });
        }
      }
    } catch (error: any) {
      addResult({
        name: 'Test Upload',
        status: 'error',
        message: error.code 
          ? `${error.code}: ${error.message}` 
          : error.message || 'Upload failed'
      });
    }

    setTesting(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Firebase Storage Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This tool tests your Firebase Storage configuration. Run diagnostics if you're experiencing upload issues.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={runDiagnostics} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            'Run Storage Diagnostics'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Test Results:</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start space-x-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{result.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && results.some(r => r.status === 'error') && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Issues found!</strong> Check the troubleshooting guide at{' '}
              <code className="text-xs">REPORT_UPLOAD_TROUBLESHOOTING.md</code>
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && results.every(r => r.status === 'success') && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>All tests passed!</strong> Firebase Storage is configured correctly.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
