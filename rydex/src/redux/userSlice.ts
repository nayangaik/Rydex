import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { UserData } from "@/types/auth.types";

export type { UserData };

interface UserState {
  userData: UserData | null;
}

const initialState: UserState = {
  userData: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserData(state, action: PayloadAction<UserData | null>) {
      state.userData = action.payload;
    },
    clearUserData(state) {
      state.userData = null;
    },
  },
});

export const { setUserData, clearUserData } = userSlice.actions;
export default userSlice.reducer;
