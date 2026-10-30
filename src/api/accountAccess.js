export function createAccountAccessClient(request) {
  return {
    context: () => request('GET','/api/accounts/context'),
    list: () => request('GET','/api/accounts'),
    update: (id,data) => request('PUT',`/api/accounts/${id}`,data),
    bulkUpdate: (ids,changes) => request('POST','/api/accounts/bulk-update',{ids,changes}),
    previewImport: rows => request('POST','/api/accounts/import-preview',{rows}),
    commitImport: (rows,fingerprint) => request('POST','/api/accounts/import-commit',{rows,fingerprint}),
    invite: data => request('POST','/api/accounts/invite',data),
    reset: (id,data) => request('POST',`/api/accounts/${id}/reset`,data),
    resendInvite: id => request('POST',`/api/accounts/${id}/resend-invite`,{}),
    complete: (token,password) => request('POST','/api/accounts/complete',{token,password}),
    changePassword: password => request('POST','/api/accounts/change-password',{password}),
  };
}
