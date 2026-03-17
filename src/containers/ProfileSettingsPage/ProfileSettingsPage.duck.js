import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { setCurrentUser } from '../../ducks/user.duck';
import {
  toBackendIdFromUuid,
  toSdkCurrentUser,
  updateCurrentUserProfileBackend,
  uploadProfileImageBackend,
} from '../../util/backend';

// ================ Async Thunks ================ //

//////////////////
// Upload Image //
//////////////////
export const uploadImageThunk = createAsyncThunk(
  'ProfileSettingsPage/uploadImage',
  ({ id, file }, { rejectWithValue, extra: sdk, getState }) => {
    const hasLocalJwt = !!localStorage.getItem('jwt');

    if (hasLocalJwt) {
      const currentUser = getState()?.user?.currentUser;
      const userId = toBackendIdFromUuid(currentUser?.id);

      return uploadProfileImageBackend(file, userId)
        .then(({ avatarUrl, uploadedImage }) => ({ id, avatarUrl, uploadedImage }))
        .catch(e => rejectWithValue({ id, error: storableError(e) }));
    }

    const bodyParams = {
      image: file,
    };
    const queryParams = {
      expand: true,
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    };

    return sdk.images
      .upload(bodyParams, queryParams)
      .then(resp => {
        const uploadedImage = resp.data.data;
        return { id, uploadedImage };
      })
      .catch(e => {
        return rejectWithValue({ id, error: storableError(e) });
      });
  }
);
// Backward compatible wrapper for the uploadImage thunk
export const uploadImage = actionPayload => dispatch => {
  return dispatch(uploadImageThunk(actionPayload));
};

////////////////////
// Update Profile //
////////////////////
export const updateProfileThunk = createAsyncThunk(
  'ProfileSettingsPage/updateProfile',
  (actionPayload, { dispatch, rejectWithValue, extra: sdk, getState }) => {
    const hasLocalJwt = !!localStorage.getItem('jwt');

    if (hasLocalJwt) {
      const token = localStorage.getItem('jwt');
      const pageState = getState()?.ProfileSettingsPage || {};
      const uploadedAvatarUrl = pageState?.image?.avatarUrl;

      const payload = {
        firstName: actionPayload?.firstName,
        lastName: actionPayload?.lastName,
        bio: actionPayload?.bio,
        ...(uploadedAvatarUrl ? { avatarUrl: uploadedAvatarUrl } : {}),
      };

      return updateCurrentUserProfileBackend(token, payload)
        .then(resp => {
          const currentUser = toSdkCurrentUser(resp?.user || {});
          dispatch(setCurrentUser(currentUser));
          return resp;
        })
        .catch(e => rejectWithValue(storableError(e)));
    }

    const queryParams = {
      expand: true,
      include: ['profileImage'],
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    };

    return sdk.currentUser
      .updateProfile(actionPayload, queryParams)
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        const currentUser = entities[0];

        // Update current user in state.user.currentUser through user.duck.js
        dispatch(setCurrentUser(currentUser));
        return response;
      })
      .catch(e => {
        return rejectWithValue(storableError(e));
      });
  }
);
// Backward compatible wrapper for the updateProfile thunk
export const updateProfile = actionPayload => dispatch => {
  return dispatch(updateProfileThunk(actionPayload));
};

// ================ Slice ================ //

const profileSettingsPageSlice = createSlice({
  name: 'ProfileSettingsPage',
  initialState: {
    image: null,
    uploadImageError: null,
    uploadInProgress: false,
    updateInProgress: false,
    updateProfileError: null,
  },
  reducers: {
    clearUpdatedForm: state => {
      state.updateProfileError = null;
      state.uploadImageError = null;
    },
  },
  extraReducers: builder => {
    builder
      // uploadImage cases
      .addCase(uploadImageThunk.pending, (state, action) => {
        const { id, file } = action.meta.arg;
        state.image = { id, file };
        state.uploadInProgress = true;
        state.uploadImageError = null;
      })
      .addCase(uploadImageThunk.fulfilled, (state, action) => {
        const { id, uploadedImage, avatarUrl } = action.payload;
        const { file } = state.image || {};
        state.image = { id, imageId: uploadedImage.id, file, uploadedImage, avatarUrl };
        state.uploadInProgress = false;
      })
      .addCase(uploadImageThunk.rejected, (state, action) => {
        state.image = null;
        state.uploadInProgress = false;
        state.uploadImageError = action.payload.error;
      })
      // updateProfile cases
      .addCase(updateProfileThunk.pending, state => {
        state.updateInProgress = true;
        state.updateProfileError = null;
      })
      .addCase(updateProfileThunk.fulfilled, state => {
        state.image = null;
        state.updateInProgress = false;
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.image = null;
        state.updateInProgress = false;
        state.updateProfileError = action.payload;
      });
  },
});

export const { clearUpdatedForm } = profileSettingsPageSlice.actions;
export default profileSettingsPageSlice.reducer;
