export function useAvatarUpload() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const { updateProfile } = useCurrentUser()

  async function uploadAvatar(file: Blob) {
    if (!user.value) return { url: null, error: new Error('Not authenticated') }

    const path = `${user.value.id}/avatar-${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: 'image/png' })

    if (uploadError) return { url: null, error: uploadError }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = data.publicUrl
    const { error: profileError } = await updateProfile({ avatar_url: publicUrl })
    if (profileError) return { url: null, error: profileError }

    return { url: publicUrl, error: null }
  }

  return { uploadAvatar }
}
